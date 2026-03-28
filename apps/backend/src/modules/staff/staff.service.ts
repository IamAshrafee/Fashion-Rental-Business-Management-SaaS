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
  async inviteStaff(tenantId: string, dto: InviteStaffDto) {
    // Enforce staff plan limit
    await this.subscriptionService.enforcePlanLimit(tenantId, 'staff');

    // Check if user already exists (by phone or email)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: dto.phone },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
      select: { id: true, fullName: true, phone: true, email: true },
    });

    // Check if this user is already a member of this tenant
    if (existingUser) {
      const existingMembership = await this.prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        if (existingMembership.isActive) {
          throw new ConflictException(
            'This person is already a member of your store',
          );
        }
        // Re-activate existing membership
        const reactivated = await this.prisma.tenantUser.update({
          where: { id: existingMembership.id },
          data: {
            role: dto.role,
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
              },
            },
          },
        });

        this.eventEmitter.emit('staff.invited', {
          tenantId,
          userId: existingUser.id,
          role: dto.role,
          reactivated: true,
        });

        return this.formatStaffResponse(reactivated);
      }
    }

    // Create new user or use existing
    const result = await this.prisma.$transaction(async (tx) => {
      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user account
        const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

        const newUser = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone: dto.phone,
            email: dto.email || null,
            passwordHash,
            role: dto.role,
          },
        });
        userId = newUser.id;
      }

      // Create TenantUser junction
      const tenantUser = await tx.tenantUser.create({
        data: {
          tenantId,
          userId,
          role: dto.role,
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
            },
          },
        },
      });

      return tenantUser;
    });

    this.eventEmitter.emit('staff.invited', {
      tenantId,
      userId: result.userId,
      role: dto.role,
      reactivated: false,
    });

    return this.formatStaffResponse(result);
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
      lastLoginAt: tenantUser.user.lastLoginAt ?? null,
      joinedAt: tenantUser.createdAt,
    };
  }
}
