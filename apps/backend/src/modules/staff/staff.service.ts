import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../tenant/subscription.service';
import { InviteStaffDto, UpdateStaffDto, StaffQueryDto } from './dto/staff.dto';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AcceptStaffInvitationDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);
  private readonly bcryptSaltRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================================
  // INVITE STAFF
  // =========================================================================

  /**
   * Invite a staff member.
   * Creates a new user account (or links existing) and creates TenantUser junction.
   */
  async inviteStaff(tenantId: string, invitedByUserId: string, dto: InviteStaffDto) {
    const phone = dto.phone?.trim() || null;
    const email = dto.email?.trim().toLowerCase() || null;
    if (!phone && !email)
      throw new BadRequestException('Phone or email is required for an invitation');
    const matchingUsers = await this.prisma.user.findMany({
      where: { OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])] },
      select: { id: true },
      take: 2,
    });
    if (matchingUsers.length > 1) {
      throw new BadRequestException('The phone and email belong to different existing accounts');
    }
    const existingUser = matchingUsers[0];
    if (existingUser) {
      const existingMembership = await this.prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: existingUser.id } },
      });
      if (existingMembership?.isActive)
        throw new ConflictException('This person is already a member of your store');
    }
    const pendingWhere = {
      tenantId,
      acceptedAt: null,
      revokedAt: null,
      OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    };
    const replacesPendingInvitation = Boolean(await this.prisma.staffInvitation.findFirst({ where: pendingWhere, select: { id: true } }));
    if (!replacesPendingInvitation) await this.subscriptionService.enforcePlanLimit(tenantId, 'staff');
    await this.prisma.staffInvitation.updateMany({
      where: pendingWhere,
      data: { revokedAt: new Date() },
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.staffInvitation.create({
      data: {
        tenantId,
        fullName: dto.fullName.trim(),
        phone,
        email,
        role: dto.role,
        permissions: dto.permissions ?? [],
        tokenHash: createHash('sha256').update(token).digest('hex'),
        invitedByUserId,
        expiresAt,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        permissions: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    this.eventEmitter.emit('staff.invited', {
      tenantId,
      invitationId: invitation.id,
      role: dto.role,
    });
    return { ...invitation, token };
  }

  async listInvitations(tenantId: string) {
    return this.prisma.staffInvitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        permissions: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvitation(tenantId: string, invitationId: string) {
    const invitation = await this.prisma.staffInvitation.findFirst({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    if (invitation.acceptedAt)
      throw new ConflictException('Accepted invitations cannot be revoked');
    return this.prisma.staffInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  async acceptInvitation(dto: AcceptStaffInvitationDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const invitation = await this.prisma.staffInvitation.findUnique({ where: { tokenHash } });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException('This staff invitation is invalid or expired');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM staff_invitations WHERE id = ${invitation.id} FOR UPDATE`,
      );
      const current = await tx.staffInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
      if (current.revokedAt || current.acceptedAt || current.expiresAt <= new Date())
        throw new ConflictException('This invitation is no longer available');
      const matchingUsers = await tx.user.findMany({
        where: {
          OR: [
            ...(current.phone ? [{ phone: current.phone }] : []),
            ...(current.email ? [{ email: current.email }] : []),
          ],
        },
        take: 2,
      });
      if (matchingUsers.length > 1) throw new ConflictException('Invitation identities no longer resolve to one account');
      let user = matchingUsers[0];
      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: current.fullName,
            phone: current.phone,
            email: current.email,
            passwordHash,
            role: current.role,
          },
        });
      } else if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
        throw new BadRequestException('This contact already has an account; enter its current password to join this store');
      }
      const membership = await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: current.tenantId, userId: user.id } },
        update: { role: current.role, permissions: current.permissions, isActive: true },
        create: {
          tenantId: current.tenantId,
          userId: user.id,
          role: current.role,
          permissions: current.permissions,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              lastLoginAt: true,
              isActive: true,
            },
          },
        },
      });
      await tx.staffInvitation.update({
        where: { id: current.id },
        data: { acceptedAt: new Date() },
      });
      return this.formatStaffResponse(membership);
    });
  }

  // =========================================================================
  // LIST STAFF
  // =========================================================================

  /**
   * List all staff members for a tenant (paginated).
   */
  async listStaff(tenantId: string, query: StaffQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.TenantUserWhereInput = {
      tenantId,
    };

    // Search by name or phone
    if (query.search) {
      where.user = {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [tenantUsers, total] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              lastLoginAt: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.tenantUser.count({ where }),
    ]);

    return {
      data: tenantUsers.map((tu) => this.formatStaffResponse(tu)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // GET STAFF BY ID
  // =========================================================================

  /**
   * Get a single staff member by TenantUser ID.
   */
  async getStaffById(tenantId: string, staffId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: staffId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            lastLoginAt: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tenantUser) {
      throw new NotFoundException('Staff member not found');
    }

    return this.formatStaffResponse(tenantUser);
  }

  // =========================================================================
  // UPDATE STAFF
  // =========================================================================

  /**
   * Update a staff member's role or active status.
   * Cannot modify the tenant owner.
   */
  async updateStaff(tenantId: string, staffId: string, dto: UpdateStaffDto) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!tenantUser) {
      throw new NotFoundException('Staff member not found');
    }

    // Cannot modify the owner
    if (tenantUser.role === 'owner') {
      throw new BadRequestException('Cannot modify the store owner');
    }

    const updated = await this.prisma.tenantUser.update({
      where: { id: staffId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            lastLoginAt: true,
            isActive: true,
          },
        },
      },
    });

    // If deactivated, revoke all sessions for this user-tenant pair
    if (dto.isActive === false) {
      await this.revokeStaffSessions(tenantUser.userId, tenantId);
    }

    this.eventEmitter.emit('staff.updated', {
      tenantId,
      staffId,
      userId: tenantUser.userId,
      changes: dto,
    });

    return this.formatStaffResponse(updated);
  }

  // =========================================================================
  // REMOVE STAFF
  // =========================================================================

  /**
   * Remove a staff member from the tenant.
   * Deletes the TenantUser junction and revokes all sessions.
   */
  async removeStaff(tenantId: string, staffId: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!tenantUser) {
      throw new NotFoundException('Staff member not found');
    }

    // Cannot remove the owner
    if (tenantUser.role === 'owner') {
      throw new BadRequestException('Cannot remove the store owner');
    }

    // Delete TenantUser junction
    await this.prisma.tenantUser.delete({
      where: { id: staffId },
    });

    // Revoke all sessions for this user-tenant pair
    await this.revokeStaffSessions(tenantUser.userId, tenantId);

    this.eventEmitter.emit('staff.removed', {
      tenantId,
      staffId,
      userId: tenantUser.userId,
    });

    return { message: 'Staff member removed' };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  /**
   * Revoke all sessions for a user at a specific tenant.
   */
  private async revokeStaffSessions(userId: string, tenantId: string): Promise<void> {
    const deleted = await this.prisma.session.deleteMany({
      where: { userId, tenantId },
    });

    if (deleted.count > 0) {
      this.logger.log(
        `Revoked ${deleted.count} session(s) for user ${userId} at tenant ${tenantId}`,
      );
    }
  }

  /**
   * Format TenantUser + User into a clean staff response.
   */
  private formatStaffResponse(tenantUser: {
    id: string;
    role: string;
    isActive: boolean;
    permissions: string[];
    createdAt: Date;
    user: {
      id: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      lastLoginAt?: Date | null;
      isActive?: boolean;
    };
  }) {
    return {
      id: tenantUser.id,
      userId: tenantUser.user.id,
      fullName: tenantUser.user.fullName,
      phone: tenantUser.user.phone,
      email: tenantUser.user.email,
      role: tenantUser.role,
      isActive: tenantUser.isActive,
      permissions: tenantUser.permissions,
      lastLoginAt: tenantUser.user.lastLoginAt ?? null,
      joinedAt: tenantUser.createdAt,
    };
  }
}
