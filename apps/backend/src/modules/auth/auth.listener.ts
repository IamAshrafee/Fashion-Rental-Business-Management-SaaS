import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Listens to auth events and records login history.
 * ADR-05: Cross-module communication via events.
 */
@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('auth.login')
  async onLogin(payload: { userId: string; tenantId: string | null; ip: string }): Promise<void> {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          eventType: 'login_success',
          ipAddress: payload.ip,
        },
      });
    } catch (error) {
      this.logger.error('Failed to record login event', error);
    }
  }

  @OnEvent('auth.loginFailed')
  async onLoginFailed(payload: {
    userId?: string;
    identifier: string;
    ip: string;
    reason: string;
  }): Promise<void> {
    try {
      // Only record if we know the user
      if (payload.userId) {
        await this.prisma.loginHistory.create({
          data: {
            userId: payload.userId,
            eventType: 'login_failed',
            ipAddress: payload.ip,
            metadata: { reason: payload.reason, identifier: payload.identifier },
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to record failed login event', error);
    }
  }

  @OnEvent('auth.sessionRevoked')
  async onSessionRevoked(payload: {
    sessionId: string;
    userId: string;
    reason: string;
    revokedBy?: string;
  }): Promise<void> {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId: payload.userId,
          eventType: 'session_revoked',
          metadata: {
            sessionId: payload.sessionId,
            reason: payload.reason,
            revokedBy: payload.revokedBy,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to record session revocation event', error);
    }
  }

  @OnEvent('auth.logout')
  async onLogout(payload: { userId: string; sessionId: string }): Promise<void> {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId: payload.userId,
          eventType: 'logout',
          metadata: { sessionId: payload.sessionId },
        },
      });
    } catch (error) {
      this.logger.error('Failed to record logout event', error);
    }
  }

  @OnEvent('auth.tokenRefreshed')
  async onTokenRefreshed(payload: { userId: string; sessionId: string }): Promise<void> {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId: payload.userId,
          eventType: 'token_refreshed',
          metadata: { sessionId: payload.sessionId },
        },
      });
    } catch (error) {
      this.logger.error('Failed to record token refresh event', error);
    }
  }
}
