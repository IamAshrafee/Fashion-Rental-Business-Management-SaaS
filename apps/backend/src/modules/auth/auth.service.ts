import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload, DeviceType } from '@closetrent/types';
import { ParsedUserAgent } from '../../common/utils/user-agent';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptSaltRounds: number;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiry: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantService: TenantService,
  ) {
    this.bcryptSaltRounds = this.configService.get<number>('bcryptSaltRounds', 12);
    this.jwtRefreshSecret = this.configService.get<string>(
      'jwt.refreshSecret',
      'dev-refresh-secret-change-in-production',
    );
    this.jwtRefreshExpiry = this.configService.get<string>('jwt.refreshExpiry', '7d');
  }

  // =========================================================================
  // REGISTER
  // =========================================================================

  async register(dto: RegisterDto, sessionInfo: { ua: ParsedUserAgent; ip: string }) {
    // Check subdomain availability
    const subdomainAvailable = await this.tenantService.isSubdomainAvailable(dto.subdomain);
    if (!subdomainAvailable) {
      throw new ConflictException('Subdomain is already taken');
    }

    // Check email uniqueness (if provided)
    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException('Email is already registered');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    // Transaction: create User + Tenant + TenantUser + StoreSettings + Subscription
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email || null,
          phone: dto.phone,
          passwordHash,
          role: 'owner',
        },
      });

      // 2. Find free plan
      const freePlan = await tx.subscriptionPlan.findFirst({
        where: { slug: 'free', isActive: true },
        select: { id: true },
      });

      // 3. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          businessName: dto.businessName,
          subdomain: dto.subdomain,
          ownerUserId: user.id,
          planId: freePlan?.id || null,
          status: 'active',
        },
      });

      // 4. Create TenantUser junction
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
          isActive: true,
        },
      });

      // 5. Create StoreSettings with locale defaults
      await tx.storeSettings.create({
        data: {
          tenantId: tenant.id,
          // Default BD locale — will be adjusted later in setup wizard
          country: 'BD',
          currencyCode: 'BDT',
          currencySymbol: '৳',
          timezone: 'Asia/Dhaka',
          dateFormat: 'DD/MM/YYYY',
          weekStart: 'saturday',
        },
      });

      // 6. Create Subscription (free plan)
      if (freePlan) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: freePlan.id,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      // 7. Seed starter template (categories, events)
      await this.seedStarterData(tx, tenant.id);

      return { user, tenant };
    });

    // Create session + tokens
    const { accessToken, refreshToken } = await this.createSession(
      result.user.id,
      result.tenant.id,
      'owner',
      sessionInfo,
    );

    // Emit event
    this.eventEmitter.emit('auth.registered', {
      userId: result.user.id,
      tenantId: result.tenant.id,
    });

    return {
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        phone: result.user.phone,
      },
      tenant: {
        id: result.tenant.id,
        businessName: result.tenant.businessName,
        subdomain: result.tenant.subdomain,
      },
      accessToken,
      refreshToken,
    };
  }

  // =========================================================================
  // LOGIN
  // =========================================================================

  async login(dto: LoginDto, sessionInfo: { ua: ParsedUserAgent; ip: string }) {
    // Find user by email or phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
      include: {
        tenantUsers: {
          where: { isActive: true },
          include: {
            tenant: {
              select: {
                id: true,
                businessName: true,
                subdomain: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      // Emit failed login event
      this.eventEmitter.emit('auth.loginFailed', {
        identifier: dto.identifier,
        ip: sessionInfo.ip,
        reason: 'User not found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // Validate password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.eventEmitter.emit('auth.loginFailed', {
        userId: user.id,
        identifier: dto.identifier,
        ip: sessionInfo.ip,
        reason: 'Invalid password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get tenants the user belongs to
    const tenants = user.tenantUsers
      .filter((tu) => tu.tenant.status === 'active')
      .map((tu) => ({
        id: tu.tenant.id,
        businessName: tu.tenant.businessName,
        subdomain: tu.tenant.subdomain,
        role: tu.role,
      }));

    // Use the first active tenant for session (multi-tenant selection handled by frontend)
    const primaryTenantUser = user.tenantUsers[0];
    const tenantId = primaryTenantUser?.tenantId || null;
    const role = primaryTenantUser?.role || user.role;

    // Apply concurrent session limits if tenant-scoped
    if (tenantId) {
      await this.enforceSessionLimits(user.id, tenantId, role, sessionInfo.ua.deviceType);
    }

    // Create session
    const { accessToken, refreshToken } = await this.createSession(
      user.id,
      tenantId,
      role as string,
      sessionInfo,
    );

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Emit login event
    this.eventEmitter.emit('auth.login', {
      userId: user.id,
      tenantId,
      ip: sessionInfo.ip,
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        role: primaryTenantUser?.role || user.role,
      },
      tenants,
      accessToken,
      refreshToken,
    };
  }

  // =========================================================================
  // TOKEN REFRESH
  // =========================================================================

  async refreshTokens(refreshToken: string) {
    // Verify the refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 1. Extract sessionId from payload
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid token format: missing sessionId');
    }

    // 2. Lookup session by explicit ID
    const session = await this.prisma.session.findUnique({
      where: {
        id: payload.sessionId,
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    // 3. Verify the token against the securely stored hash
    const isTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!isTokenValid) {
      // Token rotation mismatch — this token is invalid for this session
      throw new UnauthorizedException('Invalid session token');
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      // Clean up expired session
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session has expired');
    }

    // Generate new token pair (rotation)
    const newAccessToken = this.generateAccessToken({
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      sessionId: session.id,
    });

    const newRefreshToken = this.generateRefreshToken({
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      sessionId: session.id,
    });

    // Update session with new refresh token hash
    const newRefreshHash = await this.hashToken(newRefreshToken);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshHash,
        lastActiveAt: new Date(),
      },
    });

    // Emit event
    this.eventEmitter.emit('auth.tokenRefreshed', {
      userId: payload.sub,
      sessionId: session.id,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // =========================================================================
  // LOGOUT
  // =========================================================================

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });

    this.eventEmitter.emit('auth.logout', { userId, sessionId });
  }

  // =========================================================================
  // PASSWORD RESET
  // =========================================================================

  async forgotPassword(dto: ForgotPasswordDto) {
    // Find user
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
      select: { id: true },
    });

    // Always return success (don't reveal if user exists)
    if (!user) {
      return { message: 'If an account exists, a reset link has been sent', expiresIn: 3600 };
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (using metadata in a simple way)
    // In production, use a dedicated password_resets table or Redis
    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        eventType: 'login_failed', // Reuse as "password_reset_requested"
        metadata: {
          type: 'password_reset',
          tokenHash: resetTokenHash,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    // Emit event for notification module to send OTP/email
    this.eventEmitter.emit('auth.passwordResetRequested', {
      userId: user.id,
      resetToken, // The plain token — NotificationModule will send this
      expiresAt,
    });

    return { message: 'If an account exists, a reset link has been sent', expiresIn: 3600 };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Find user by identifier
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { phone: dto.identifier },
        ],
      },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset request');
    }

    // Find the most recent reset token in login history
    const resetEntry = await this.prisma.loginHistory.findFirst({
      where: {
        userId: user.id,
        eventType: 'login_failed',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetEntry?.metadata) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const metadata = resetEntry.metadata as Record<string, unknown>;
    if (metadata.type !== 'password_reset') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check expiry
    const expiresAt = new Date(metadata.expiresAt as string);
    if (new Date() > expiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    // Verify token
    const tokenValid = await bcrypt.compare(dto.token, metadata.tokenHash as string);
    if (!tokenValid) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Update password
    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptSaltRounds);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all sessions for this user (force re-login)
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    this.eventEmitter.emit('auth.passwordReset', { userId: user.id });

    return { message: 'Password reset successful' };
  }

  // =========================================================================
  // GET CURRENT USER (ME)
  // =========================================================================

  async getMe(userId: string, tenantId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let currentTenant = null;
    if (tenantId) {
      const tenantUser = await this.prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
        include: {
          tenant: {
            select: {
              id: true,
              businessName: true,
              subdomain: true,
              customDomain: true,
              status: true,
              logoUrl: true,
            },
          },
        },
      });

      if (tenantUser) {
        currentTenant = {
          ...tenantUser.tenant,
          role: tenantUser.role,
        };
      }
    }

    return {
      ...user,
      currentTenant,
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async createSession(
    userId: string,
    tenantId: string | null,
    role: string,
    sessionInfo: { ua: ParsedUserAgent; ip: string },
  ) {
    const refreshPayload: JwtPayload = {
      sub: userId,
      tenantId,
      role: role as JwtPayload['role'],
      sessionId: '', // Placeholder — will update after creating session
    };

    const refreshToken = this.generateRefreshToken(refreshPayload);
    const refreshTokenHash = await this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create session record
    const session = await this.prisma.session.create({
      data: {
        userId,
        tenantId,
        refreshTokenHash,
        deviceName: sessionInfo.ua.deviceName,
        deviceType: sessionInfo.ua.deviceType as DeviceType,
        browser: sessionInfo.ua.browser,
        os: sessionInfo.ua.os,
        ipAddress: sessionInfo.ip,
        lastActiveAt: new Date(),
        expiresAt,
      },
    });

    // Generate access token with the real sessionId
    const accessToken = this.generateAccessToken({
      sub: userId,
      tenantId,
      role: role as JwtPayload['role'],
      sessionId: session.id,
    });

    // Re-generate refresh token with sessionId
    const finalRefreshToken = this.generateRefreshToken({
      sub: userId,
      tenantId,
      role: role as JwtPayload['role'],
      sessionId: session.id,
    });

    // Update session with the final refresh token hash
    const finalRefreshHash = await this.hashToken(finalRefreshToken);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: finalRefreshHash },
    });

    return { accessToken, refreshToken: finalRefreshToken, sessionId: session.id };
  }

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: this.jwtRefreshExpiry,
    });
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  /**
   * Enforce concurrent session limits per tenant settings.
   * Owners and saas_admin are exempt.
   */
  private async enforceSessionLimits(
    userId: string,
    tenantId: string,
    role: string,
    deviceType: DeviceType,
  ): Promise<void> {
    // Owners and admins are exempt from session limits
    if (role === 'owner' || role === 'saas_admin') return;

    const maxSessions = await this.tenantService.getMaxConcurrentSessions(tenantId);
    if (maxSessions <= 0) return; // Unlimited

    const activeSessions = await this.prisma.session.findMany({
      where: { userId, tenantId },
      orderBy: { lastActiveAt: 'asc' },
    });

    if (activeSessions.length >= maxSessions) {
      // Revoke oldest sessions to make room
      const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1);
      for (const sess of sessionsToRevoke) {
        await this.prisma.session.delete({ where: { id: sess.id } });
        this.eventEmitter.emit('auth.sessionRevoked', {
          sessionId: sess.id,
          userId,
          reason: 'session_limit_exceeded',
        });
      }
      this.logger.log(
        `Revoked ${sessionsToRevoke.length} session(s) for user ${userId} (limit: ${maxSessions})`,
      );
    }
  }

  /**
   * Seed starter template data for a new tenant.
   */
  private async seedStarterData(tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0], tenantId: string): Promise<void> {
    // Seed default categories for BD market
    const defaultCategories = [
      { name: 'Lehenga', slug: 'lehenga', displayOrder: 1 },
      { name: 'Saree', slug: 'saree', displayOrder: 2 },
      { name: 'Gown', slug: 'gown', displayOrder: 3 },
      { name: 'Sherwani', slug: 'sherwani', displayOrder: 4 },
      { name: 'Bridal Wear', slug: 'bridal-wear', displayOrder: 5 },
      { name: 'Party Wear', slug: 'party-wear', displayOrder: 6 },
      { name: 'Jewellery', slug: 'jewellery', displayOrder: 7 },
      { name: 'Accessories', slug: 'accessories', displayOrder: 8 },
    ];

    for (const cat of defaultCategories) {
      await (tx as any).category.create({
        data: { ...cat, tenantId },
      });
    }

    // Seed default events
    const defaultEvents = [
      { name: 'Wedding', slug: 'wedding', displayOrder: 1 },
      { name: 'Engagement', slug: 'engagement', displayOrder: 2 },
      { name: 'Holud/Gaye Holud', slug: 'holud', displayOrder: 3 },
      { name: 'Reception', slug: 'reception', displayOrder: 4 },
      { name: 'Walima', slug: 'walima', displayOrder: 5 },
      { name: 'Mehendi', slug: 'mehendi', displayOrder: 6 },
      { name: 'Birthday', slug: 'birthday', displayOrder: 7 },
      { name: 'Party/Formal', slug: 'party-formal', displayOrder: 8 },
      { name: 'Photoshoot', slug: 'photoshoot', displayOrder: 9 },
      { name: 'Eid', slug: 'eid', displayOrder: 10 },
    ];

    for (const event of defaultEvents) {
      await (tx as any).event.create({
        data: { ...event, tenantId },
      });
    }
  }
}
