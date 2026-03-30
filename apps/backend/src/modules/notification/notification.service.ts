import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification.dto';

export type NotificationType =
  | 'new_booking'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_shipped'
  | 'booking_delivered'
  | 'booking_overdue'
  | 'booking_returned'
  | 'booking_completed'
  | 'booking_inspected'
  | 'payment_received'
  | 'return_reminder'
  | 'deposit_refunded'
  | 'deposit_forfeited'
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
   * If no tenantId is provided, cleans across all tenants (legacy fallback).
   */
  async cleanOldNotifications(tenantId?: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const where: Prisma.NotificationWhereInput = {
      createdAt: { lt: cutoff },
      ...(tenantId ? { tenantId } : {}),
    };

    const result = await this.prisma.notification.deleteMany({ where });

    this.logger.log(
      `Cleaned ${result.count} notifications older than 30 days` +
        (tenantId ? ` for tenant ${tenantId}` : ' (all tenants)'),
    );
    return result.count;
  }
}
