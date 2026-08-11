import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification.dto';

export type NotificationType =
  | 'new_booking'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'pickup_requested'
  | 'booking_delivered'
  | 'booking_overdue'
  | 'booking_returned'
  | 'booking_completed'
  | 'booking_inspected'
  | 'payment_received'
  | 'return_reminder'
  | 'deposit_settled'
  | 'damage_reported'
  | 'subscription_expiring'
  | 'tenant_suspended';

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new in-app notification.
   * Called by event listeners — never directly from controllers.
   */
  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? Prisma.JsonNull,
      },
    });
    this.logger.debug(`Notification created: ${input.type} for tenant ${input.tenantId}`);
    return notification;
  }

  async createSmsDelivery(input: {
    tenantId: string;
    recipient: string;
    template: string;
    payload: Prisma.InputJsonObject;
    dedupeKey?: string;
  }) {
    if (input.dedupeKey) {
      const existing = await this.prisma.notificationDelivery.findUnique({
        where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: input.dedupeKey } },
      });
      if (existing) return existing;
    }
    try {
      return await this.prisma.notificationDelivery.create({
        data: { ...input, channel: 'sms' },
      });
    } catch (error) {
      if (input.dedupeKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.notificationDelivery.findUniqueOrThrow({
          where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: input.dedupeKey } },
        });
      }
      throw error;
    }
  }

  async beginSmsDelivery(id: string) {
    return this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        lastError: null,
        nextAttemptAt: null,
      },
    });
  }

  async completeSmsDelivery(id: string) {
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), lastError: null, nextAttemptAt: null },
    });
  }

  async failSmsDelivery(id: string, error: string, attempts: number) {
    const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
    await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'failed',
        lastError: error.slice(0, 2000),
        nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
      },
    });
  }

  async recoverableSmsDeliveries(limit = 500) {
    return this.prisma.notificationDelivery.findMany({
      where: {
        channel: 'sms',
        status: { in: ['pending', 'failed'] },
        attempts: { lt: 5 },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      select: { id: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * List notifications for a tenant (paginated, unread first).
   */
  async list(tenantId: string, query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      tenantId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { tenantId, isRead: false } }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /**
   * Get unread notification count (for badge display).
   */
  async unreadCount(tenantId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { tenantId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(tenantId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
      select: { id: true, isRead: true, readAt: true },
    });
  }

  /**
   * Mark all notifications as read for a tenant.
   */
  async markAllRead(tenantId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { markedCount: result.count };
  }

  /**
   * Delete (dismiss) a single notification.
   */
  async deleteById(tenantId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  /**
   * Clean notifications older than 30 days for a specific tenant.
   * Called by cleanup CRON job per-tenant for proper data isolation.
   */
  async cleanOldNotifications(tenantId: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const where: Prisma.NotificationWhereInput = {
      createdAt: { lt: cutoff },
      tenantId,
    };

    const result = await this.prisma.notification.deleteMany({ where });

    this.logger.log(
      `Cleaned ${result.count} notifications older than 30 days for tenant ${tenantId}`,
    );
    return result.count;
  }
}
