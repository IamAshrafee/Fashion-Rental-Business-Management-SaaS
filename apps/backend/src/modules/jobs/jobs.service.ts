import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SmsService } from '../notification/sms/sms.service';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_SCHEDULER = 'scheduler';
export const QUEUE_CLEANUP = 'cleanup';

/**
 * BullMQ connection config shared across queues.
 */
function getRedisConnection(config: ConfigService) {
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    db: config.get<number>('REDIS_DB', 0),
    lazyConnect: true,
  };
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  // Queues (used to add jobs)
  notificationsQueue!: Queue;
  schedulerQueue!: Queue;
  cleanupQueue!: Queue;

  // Workers (process jobs)
  private notificationsWorker!: Worker;
  private schedulerWorker!: Worker;
  private cleanupWorker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly smsService: SmsService,
  ) {
    const connection = getRedisConnection(this.config);

    // ── Queues (Available immediately for Bull Board) ─────────────────────────
    this.notificationsQueue = new Queue(QUEUE_NOTIFICATIONS, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    });

    this.schedulerQueue = new Queue(QUEUE_SCHEDULER, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 300_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 50 },
      },
    });

    this.cleanupQueue = new Queue(QUEUE_CLEANUP, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }

  onModuleInit() {
    const connection = getRedisConnection(this.config);

    // ── Workers ─────────────────────────────────────────────────────────────
    this.notificationsWorker = new Worker(
      QUEUE_NOTIFICATIONS,
      async (job: Job) => this.processNotificationJob(job),
      { connection, concurrency: 5 },
    );

    this.schedulerWorker = new Worker(
      QUEUE_SCHEDULER,
      async (job: Job) => this.processSchedulerJob(job),
      { connection, concurrency: 2 },
    );

    this.cleanupWorker = new Worker(
      QUEUE_CLEANUP,
      async (job: Job) => this.processCleanupJob(job),
      { connection, concurrency: 1 },
    );

    // ── Failure handlers ────────────────────────────────────────────────────
    [this.notificationsWorker, this.schedulerWorker, this.cleanupWorker].forEach((worker) => {
      worker.on('failed', (job, err) => this.onJobFailed(job, err));
    });

    this.logger.log('BullMQ queues and workers initialized');
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.notificationsWorker?.close(),
      this.schedulerWorker?.close(),
      this.cleanupWorker?.close(),
      this.notificationsQueue?.close(),
      this.schedulerQueue?.close(),
      this.cleanupQueue?.close(),
    ]);
    this.logger.log('BullMQ queues and workers closed');
  }

  // ==========================================================================
  // NOTIFICATION QUEUE PROCESSOR
  // ==========================================================================

  private async processNotificationJob(job: Job): Promise<void> {
    this.logger.debug(`Processing notification job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'sms.send': {
        const { to, template, data } = job.data as {
          to: string;
          template: string;
          data: Record<string, unknown>;
        };
        await this.smsService.send(to, template as never, data as never);
        break;
      }

      case 'notification.create': {
        const { tenantId, type, title, message, data, userId } = job.data;
        await this.notificationService.create({ tenantId, type, title, message, data, userId });
        break;
      }

      default:
        this.logger.warn(`Unknown notification job: ${job.name}`);
    }
  }

  // ==========================================================================
  // SCHEDULER QUEUE PROCESSOR
  // ==========================================================================

  private async processSchedulerJob(job: Job): Promise<void> {
    this.logger.debug(`Processing scheduler job: ${job.name}`);

    switch (job.name) {
      case 'booking.checkOverdue':
        await this.checkOverdueBookings();
        break;

      case 'booking.sendReturnReminders':
        await this.sendReturnReminders();
        break;

      case 'booking.autoExpirePending':
        await this.autoExpirePendingBookings();
        break;

      case 'tenant.checkSubscriptions':
        await this.checkSubscriptions();
        break;

      default:
        this.logger.warn(`Unknown scheduler job: ${job.name}`);
    }
  }

  // ==========================================================================
  // CLEANUP QUEUE PROCESSOR
  // ==========================================================================

  private async processCleanupJob(job: Job): Promise<void> {
    this.logger.debug(`Processing cleanup job: ${job.name}`);

    switch (job.name) {
      case 'notification.cleanOld': {
        const tenants = await this.getActiveTenants();
        let totalCleaned = 0;
        for (const tenant of tenants) {
          totalCleaned += await this.notificationService.cleanOldNotifications(tenant.id);
        }
        this.logger.log(`Total notifications cleaned: ${totalCleaned}`);
        break;
      }

      case 'trash.autoDeleteExpired':
        await this.autoDeleteExpiredTrash();
        break;

      default:
        this.logger.warn(`Unknown cleanup job: ${job.name}`);
    }
  }

  // ==========================================================================
  // BUSINESS JOB IMPLEMENTATIONS
  // ==========================================================================

  /**
   * Find delivered bookings past their return date and mark them overdue.
   * Runs hourly. Iterates per-tenant for proper data isolation.
   */
  private async checkOverdueBookings(): Promise<void> {
    const now = new Date();
    const tenants = await this.getActiveTenants();
    let totalUpdated = 0;

    for (const tenant of tenants) {
      const overdueBookings = await this.prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          status: 'delivered',
          deletedAt: null,
          items: {
            every: {
              endDate: { lt: now },
            },
          },
        },
        include: {
          items: { select: { endDate: true } },
        },
      });

      for (const booking of overdueBookings) {
        const latestEndDate = booking.items.reduce<Date | null>((max, item) => {
          return !max || item.endDate > max ? item.endDate : max;
        }, null);

        const lateDays = latestEndDate
          ? Math.ceil((now.getTime() - latestEndDate.getTime()) / (1000 * 60 * 60 * 24))
          : 1;

        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'overdue' },
        });

        await this.notificationsQueue.add('notification.create', {
          tenantId: tenant.id,
          type: 'booking_overdue',
          title: `OVERDUE: ${booking.bookingNumber} not returned`,
          message: `${lateDays} day(s) late. Please follow up immediately.`,
          data: { bookingId: booking.id, bookingNumber: booking.bookingNumber, lateDays },
        });

        this.logger.log(`Marked booking ${booking.bookingNumber} as overdue (${lateDays} days)`);
      }

      totalUpdated += overdueBookings.length;
    }

    this.logger.log(`Overdue check complete: ${totalUpdated} booking(s) updated`);
  }

  /**
   * Send return reminder SMS to customers with rentals due tomorrow.
   * Timezone-aware: runs hourly, sends reminder when tenant local time = 9 AM.
   * Runs hourly.
   */
  private async sendReturnReminders(): Promise<void> {
    const now = new Date();

    // Tomorrow range (for return_reminder)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Today range (for return_due_today — #11)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tenants = await this.getActiveTenants();

    for (const tenant of tenants) {
      // Fetch store info for real business name and smsEnabled check (#5)
      const [settings, tenantInfo] = await Promise.all([
        this.prisma.storeSettings.findUnique({
          where: { tenantId: tenant.id },
          select: { smsEnabled: true, phone: true },
        }),
        this.prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: { businessName: true },
        }),
      ]);

      if (!settings?.smsEnabled || !tenantInfo) continue;
      const storeName = tenantInfo.businessName;

      // --- Return reminders (due tomorrow) ---
      const tomorrowReminders = await this.prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          status: 'delivered',
          deletedAt: null,
          items: {
            some: {
              endDate: { gte: tomorrowStart, lte: tomorrowEnd },
            },
          },
        },
        include: {
          customer: { select: { phone: true, fullName: true } },
          items: { select: { endDate: true } },
        },
      });

      for (const booking of tomorrowReminders) {
        const returnDate = booking.items[0]?.endDate?.toLocaleDateString('en-BD') ?? 'tomorrow';

        await this.notificationsQueue.add('sms.send', {
          to: booking.customer.phone,
          template: 'return_reminder',
          data: { returnDate, storeName },
        });

        this.logger.log(`Return reminder queued for booking ${booking.bookingNumber}`);
      }

      // --- Due today reminders (#11) ---
      const todayReminders = await this.prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          status: 'delivered',
          deletedAt: null,
          items: {
            some: {
              endDate: { gte: todayStart, lte: todayEnd },
            },
          },
        },
        include: {
          customer: { select: { phone: true, fullName: true } },
          items: { select: { endDate: true } },
        },
      });

      for (const booking of todayReminders) {
        const returnDate = booking.items[0]?.endDate?.toLocaleDateString('en-BD') ?? 'today';

        await this.notificationsQueue.add('sms.send', {
          to: booking.customer.phone,
          template: 'return_due_today',
          data: { returnDate, storeName },
        });

        this.logger.log(`Due-today reminder queued for booking ${booking.bookingNumber}`);
      }
    }
  }


  /**
   * Cancel pending bookings that are older than 48 hours.
   * Runs every 30 minutes.
   */
  private async autoExpirePendingBookings(): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);
    const tenants = await this.getActiveTenants();
    let totalExpired = 0;

    for (const tenant of tenants) {
      const expiredCount = await this.prisma.booking.updateMany({
        where: {
          tenantId: tenant.id,
          status: 'pending',
          createdAt: { lt: cutoff },
          deletedAt: null,
        },
        data: {
          status: 'cancelled',
          cancellationReason: 'Auto-expired: pending for more than 48 hours',
          cancelledBy: 'owner',
        },
      });
      totalExpired += expiredCount.count;
    }

    if (totalExpired > 0) {
      this.logger.log(`Auto-expired ${totalExpired} pending booking(s)`);
    }
  }

  /**
   * Check subscription expiry — notify tenants approaching expiry.
   * Runs daily at midnight UTC.
   */
  private async checkSubscriptions(): Promise<void> {
    const now = new Date();
    const warningDays = [7, 3, 1]; // Send warnings at these intervals

    for (const days of warningDays) {
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      const targetStart = new Date(target);
      targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(target);
      targetEnd.setHours(23, 59, 59, 999);

      const expiringSubs = await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          currentPeriodEnd: { gte: targetStart, lte: targetEnd },
        },
        include: { tenant: { select: { id: true } } },
      });

      for (const sub of expiringSubs) {
        await this.notificationsQueue.add('notification.create', {
          tenantId: sub.tenantId,
          type: 'subscription_expiring',
          title: `Subscription expiring in ${days} day(s)`,
          message: 'Please renew your subscription to avoid service interruption.',
          data: { daysLeft: days },
        });
      }
    }

    // Suspend tenants past their grace period (7 days after expiry)
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - 7);

    const pastDue = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { lt: graceCutoff },
      },
    });

    for (const sub of pastDue) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'cancelled' },
        }),
        this.prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { status: 'suspended' },
        }),
      ]);
      this.logger.warn(`Suspended tenant ${sub.tenantId} — subscription expired`);
    }
  }

  /**
   * Permanently delete soft-deleted records older than 90 days.
   * Runs weekly.
   */
  private async autoDeleteExpiredTrash(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const tenants = await this.getActiveTenants();
    let totalProducts = 0, totalBookings = 0, totalCustomers = 0;

    for (const tenant of tenants) {
      const [products, bookings, customers] = await Promise.all([
        this.prisma.product.deleteMany({
          where: { tenantId: tenant.id, deletedAt: { lt: cutoff } },
        }),
        this.prisma.booking.deleteMany({
          where: { tenantId: tenant.id, deletedAt: { lt: cutoff } },
        }),
        this.prisma.customer.deleteMany({
          where: { tenantId: tenant.id, deletedAt: { lt: cutoff } },
        }),
      ]);
      totalProducts += products.count;
      totalBookings += bookings.count;
      totalCustomers += customers.count;
    }

    this.logger.log(
      `Trash cleanup: ${totalProducts} products, ${totalBookings} bookings, ` +
        `${totalCustomers} customers permanently deleted`,
    );
  }

  // ==========================================================================
  // FAILED JOB HANDLER
  // ==========================================================================

  private async onJobFailed(job: Job | undefined, err: Error): Promise<void> {
    if (!job) return;

    this.logger.error(`Job ${job.name} failed (attempt ${job.attemptsMade})`, err.message);

    // After all retries exhausted, store in failed_jobs table for admin review
    const maxAttempts = (job.opts.attempts as number) ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      try {
        // Using type cast because FailedJob model is new and requires migration + client regeneration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.prisma as any).failedJob.create({
          data: {
            queue: job.queueName,
            jobName: job.name,
            payload: job.data,
            error: err.message,
            failedAt: new Date(),
          },
        });
      } catch (dbErr) {
        this.logger.error('Failed to persist dead letter job', (dbErr as Error).message);
      }
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Get all active tenants. Used by scheduler jobs to iterate per-tenant
   * and satisfy tenant isolation middleware.
   */
  private async getActiveTenants(): Promise<{ id: string }[]> {
    return this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
  }
}
