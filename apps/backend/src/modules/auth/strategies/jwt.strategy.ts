import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '@closetrent/types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'dev-jwt-secret-change-in-production'),
    });
  }

  /**
   * Called by Passport after successfully verifying the JWT.
   * The returned value is attached to `req.user`.
   *
   * Session, account, tenant, and membership state are revalidated here so
   * manual revocation, staff deactivation, and store suspension take effect
   * immediately instead of waiting for access-token expiry.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      select: {
        tenantId: true,
        isImpersonation: true,
        impersonatorId: true,
        user: { select: { role: true } },
        impersonator: { select: { role: true, isActive: true } },
      },
    });
    if (!session) {
      throw new UnauthorizedException('Session has expired or been revoked');
    }

    if (payload.isImpersonation) {
      if (
        !session.isImpersonation
        || !session.impersonatorId
        || session.impersonatorId !== payload.impersonatorId
        || session.impersonator?.role !== 'saas_admin'
        || !session.impersonator.isActive
        || session.tenantId !== payload.tenantId
      ) {
        throw new UnauthorizedException('Invalid impersonation session');
      }
    } else if (session.isImpersonation) {
      throw new UnauthorizedException('Invalid impersonation token');
    }

    if (session.user.role === 'saas_admin') {
      return {
        id: payload.sub,
        email: null,
        phone: null,
        role: 'saas_admin',
        tenantId: null,
        sessionId: payload.sessionId,
      };
    }

    if (session.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Session store context changed; refresh and retry');
    }

    let role = session.user.role;
    if (session.tenantId) {
      const membership = await this.prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: {
            tenantId: session.tenantId,
            userId: payload.sub,
          },
        },
        include: { tenant: { select: { status: true } } },
      });
      if (!membership?.isActive || membership.tenant.status !== 'active') {
        throw new UnauthorizedException('Store access has been revoked or suspended');
      }
      role = membership.role;
    }

    return {
      id: payload.sub,
      email: null, // Not in JWT — load from DB if needed
      phone: null,
      role,
      tenantId: session.tenantId,
      sessionId: payload.sessionId,
      ...(payload.isImpersonation
        ? { isImpersonation: true, impersonatorId: session.impersonatorId ?? undefined }
        : {}),
    };
  }
}
