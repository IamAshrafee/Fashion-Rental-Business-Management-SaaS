import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * List all active sessions for the current user.
   */
  async listUserSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        browser: true,
        os: true,
        ipAddress: true,
        location: true,
        lastActiveAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Revoke a specific session.
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    revokedBy: string,
  ): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    this.eventEmitter.emit('auth.sessionRevoked', {
      sessionId,
      userId,
      reason: 'manual_revocation',
      revokedBy,
    });
  }

  /**
   * Revoke all sessions except the current one.
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        NOT: { id: currentSessionId },
      },
      select: { id: true },
    });

    if (sessions.length === 0) return 0;

    await this.prisma.session.deleteMany({
      where: {
        userId,
        NOT: { id: currentSessionId },
      },
    });

    // Emit events for each revoked session
    for (const sess of sessions) {
      this.eventEmitter.emit('auth.sessionRevoked', {
        sessionId: sess.id,
        userId,
        reason: 'revoke_all_others',
        revokedBy: userId,
      });
    }

    return sessions.length;
  }

  /**
   * Get login history for a user (paginated).
   */
  async getLoginHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          eventType: true,
          browser: true,
          os: true,
          ipAddress: true,
          location: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.loginHistory.count({
        where: { userId },
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * List all sessions for a tenant (owner oversight).
   */
  async listTenantSessions(tenantId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { tenantId },
      orderBy: { lastActiveAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      userName: session.user.fullName,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Revoke a staff session (owner action).
   */
  async revokeStaffSession(
    sessionId: string,
    tenantId: string,
    revokedByUserId: string,
  ): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!session) {
      throw new NotFoundException('Session not found in this tenant');
    }

    // Don't allow revoking own session through this endpoint
    if (session.userId === revokedByUserId) {
      throw new ForbiddenException('Use the session management page to revoke your own sessions');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    this.eventEmitter.emit('auth.sessionRevoked', {
      sessionId,
      userId: session.userId,
      reason: 'revoked_by_owner',
      revokedBy: revokedByUserId,
    });
  }

  /**
   * Update session last active time (debounced in caller).
   */
  async updateLastActive(sessionId: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });
    } catch {
      // Session may have been deleted — ignore
    }
  }
}
