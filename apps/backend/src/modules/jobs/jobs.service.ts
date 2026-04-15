import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SmsService } from '../notification/sms/sms.service';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { MeteringService } from '../metering/metering.service';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_SCHEDULER = 'scheduler';
export const QUEUE_CLEANUP = 'cleanup';
export const QUEUE_FULFILLMENT = 'fulfillment';

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
  fulfillmentQueue!: Queue;
  notificationsQueue!: Queue;
  schedulerQueue!: Queue;
  cleanupQueue!: Queue;

  // Workers (process jobs)
  private fulfillmentWorker!: Worker;
  private notificationsWorker!: Worker;
  private schedulerWorker!: Worker;
  private cleanupWorker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly smsService: SmsService,
    @Inject(forwardRef(() => FulfillmentService))
    private readonly fulfillmentService: FulfillmentService,
    private readonly meteringService: MeteringService,
  ) {
    const connection = getRedisConnection(this.config);

    // ── Queues (Available immediately for Bull Board) ─────────────────────────
    this.fulfillmentQueue = new Queue(QUEUE_FULFILLMENT, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 50 },
      },
    });

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
    this.fulfillmentWorker = new Worker(
      QUEUE_FULFILLMENT,
      async (job: Job) => this.processFulfillmentJob(job),
      { connection, concurrency: 2 },
    );

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
    [this.fulfillmentWorker, this.notificationsWorker, this.schedulerWorker, this.cleanupWorker].forEach((worker) => {
      worker.on('failed', (job, err) => this.onJobFailed(job, err));
    });

    this.logger.log('BullMQ queues and workers initialized');
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.fulfillmentWorker?.close(),
      this.notificationsWorker?.close(),
      this.schedulerWorker?.close(),
      this.cleanupWorker?.close(),
      this.fulfillmentQueue?.close(),
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
  // FULFILLMENT QUEUE PROCESSOR
  // ==========================================================================

  private async processFulfillmentJob(job: Job): Promise<void> {
    this.logger.debug(`Processing fulfillment job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'fulfillment.requestPickup': {
        const { tenantId, bookingId } = job.data as {
          tenantId: string;
          bookingId: string;
        };
        await this.fulfillmentService.requestPickup(tenantId, bookingId);
        break;
      }

      case 'fulfillment.pollCourierStatus':
        await this.fulfillmentService.pollAllCourierStatuses();
        break;

      case 'fulfillment.checkStuckPickups':
        await this.fulfillmentService.checkStuckPickups();
        break;

      default:
        this.logger.warn(`Unknown fulfillment job: ${job.name}`);
    }
  }

  // ==========================================================================
  // EVENT LISTENER: Schedule Pickup
  // ==========================================================================

  /**
   * Listens for 'fulfillment.schedulePickup' events emitted by FulfillmentService
   * when a booking is confirmed. Creates a delayed BullMQ job that fires
   * at the calculated pickup date.
   */
  @OnEvent('fulfillment.schedulePickup')
  async onSchedulePickup(payload: {
    tenantId: string;
    bookingId: string;
    bookingNumber: string;
    scheduledAt: string;
    delayMs: number;
  }): Promise<void> {
    const { tenantId, bookingId, bookingNumber, delayMs } = payload;

    const jobId = `pickup:${bookingId}`;

    const job = await this.fulfillmentQueue.add(
      'fulfillment.requestPickup',
      { tenantId, bookingId, bookingNumber },
      {
        jobId,
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    // Save the job ID on the booking so it can be cancelled if needed
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { pickupJobId: job.id ?? jobId },
    });

    this.logger.log(
      `Pickup job scheduled for ${bookingNumber}: delay=${Math.ceil(delayMs / (1000 * 60 * 60))}h, jobId=${job.id}`,
    );
  }

  /**
   * Listens for 'booking.cancelled' events and removes any pending
   * pickup job from the fulfillment queue.
   */
  @OnEvent('booking.cancelled')
  async onBookingCancelled(payload: {
    tenantId: string;
    bookingId: string;
    bookingNumber: string;
  }): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: payload.bookingId },
      select: { pickupJobId: true },
    });

    if (booking?.pickupJobId) {
      try {
        const job = await this.fulfillmentQueue.getJob(booking.pickupJobId);
        if (job && (await job.isDelayed())) {
          await job.remove();
          this.logger.log(
            `Cancelled pickup job ${booking.pickupJobId} for ${payload.bookingNumber}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to cancel pickup job ${booking.pickupJobId}: ${(err as Error).message}`,
        );
      }
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

      case 'product.recalculatePopularity':
        await this.recalculatePopularityScores();
        break;

      case 'metering.snapshotDaily':
        await this.snapshotDailyMetrics();
        break;

      case 'metering.computeResourceUsage':
        await this.computeResourceUsage();
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

      case 'metering.cleanOldSnapshots':
        await this.cleanOldSnapshots();
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
   * Item 13: Fixed to emit proper events, set statusReason, invalidate sessions.
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
          // Skip free plan subscriptions — they have perpetual period
          plan: { slug: { not: 'free' } },
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
        // Never auto-suspend free plan tenants
        plan: { slug: { not: 'free' } },
      },
      include: {
        tenant: { select: { id: true, businessName: true, ownerUserId: true } },
      },
    });

    for (const sub of pastDue) {
      await this.prisma.$transaction(async (tx) => {
        // 1. Update subscription status
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'cancelled' },
        });

        // 2. Update tenant status with reason
        await tx.tenant.update({
          where: { id: sub.tenantId },
          data: {
            status: 'suspended',
            statusReason: 'Subscription expired — auto-suspended after 7-day grace period',
          },
        });

        // 3. Invalidate all active sessions for this tenant
        await tx.session.deleteMany({
          where: { tenantId: sub.tenantId },
        });
      });

      // 4. Emit domain event for notification handlers
      this.notificationsQueue.add('notification.create', {
        tenantId: sub.tenantId,
        type: 'tenant_suspended',
        title: 'Store Suspended',
        message: 'Your subscription has expired. Please contact support to renew.',
        data: { reason: 'subscription_expired' },
      });

      this.logger.warn(
        `Auto-suspended tenant ${sub.tenantId} (${sub.tenant.businessName}) — subscription expired past grace period`,
      );
    }

    if (pastDue.length > 0) {
      this.logger.log(`Auto-suspended ${pastDue.length} tenant(s) with expired subscriptions`);
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

  /**
   * Recalculate popularity scores for all products across all tenants.
   * Uses raw SQL for maximum efficiency — single pass over storefront_events.
   * Scoring: product_view = 1pt, add_to_cart = 3pt, within a 30-day rolling window.
   * Time decay is built-in: events older than 30 days are excluded.
   * Runs every 2 hours via CRON.
   */
  private async recalculatePopularityScores(): Promise<void> {
    const start = Date.now();

    try {
      // Step 1: Update products that have recent events with their computed score
      await this.prisma.$executeRaw`
        UPDATE products p
        SET popularity_score = scores.score,
            updated_at = NOW()
        FROM (
          SELECT se.product_id,
                 SUM(CASE
                   WHEN se.event_type = 'add_to_cart' THEN 3
                   ELSE 1
                 END)::INTEGER AS score
          FROM storefront_events se
          WHERE se.created_at >= NOW() - INTERVAL '30 days'
            AND se.product_id IS NOT NULL
          GROUP BY se.product_id
        ) scores
        WHERE p.id = scores.product_id
      `;

      // Step 2: Zero out products with no recent events (time decay)
      await this.prisma.$executeRaw`
        UPDATE products
        SET popularity_score = 0,
            updated_at = NOW()
        WHERE popularity_score > 0
          AND id NOT IN (
            SELECT DISTINCT product_id
            FROM storefront_events
            WHERE created_at >= NOW() - INTERVAL '30 days'
              AND product_id IS NOT NULL
          )
      `;

      const elapsed = Date.now() - start;
      this.logger.log(`Popularity scores recalculated in ${elapsed}ms`);
    } catch (error) {
      this.logger.error(`Failed to recalculate popularity scores: ${(error as Error).message}`);
      throw error;
    }
  }

  // ==========================================================================
  // METERING AGGREGATOR JOBS
  // ==========================================================================

  /**
   * Snapshot today's API metrics from Redis into PostgreSQL.
   * Idempotent: uses upsert with @@unique([tenantId, snapshotDate]).
   * Runs hourly — builds up an accurate picture of the day as it progresses.
   */
  private async snapshotDailyMetrics(): Promise<void> {
    const start = Date.now();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to midnight UTC for @db.Date

    const tenants = await this.getActiveTenants();
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let upserted = 0;
    for (const tenant of tenants) {
      try {
        const metrics = await this.meteringService.readDailyCounters(tenant.id, dateStr);

        // Skip tenants with zero activity (don't pollute DB with empty rows)
        if (metrics.apiRequestCount === 0) continue;

        await (this.prisma as any).tenantUsageSnapshot.upsert({
          where: {
            tenantId_snapshotDate: {
              tenantId: tenant.id,
              snapshotDate: today,
            },
          },
          create: {
            tenantId: tenant.id,
            snapshotDate: today,
            apiRequestCount: metrics.apiRequestCount,
            avgResponseTimeMs: metrics.avgResponseTimeMs,
            p95ResponseTimeMs: metrics.p95ResponseTimeMs,
            errorCount: metrics.errorCount,
            totalBandwidthKb: metrics.totalBandwidthKb,
            peakRpm: metrics.peakRpm,
          },
          update: {
            // Overwrite with latest accumulated values (always increasing throughout the day)
            apiRequestCount: metrics.apiRequestCount,
            avgResponseTimeMs: metrics.avgResponseTimeMs,
            p95ResponseTimeMs: metrics.p95ResponseTimeMs,
            errorCount: metrics.errorCount,
            totalBandwidthKb: metrics.totalBandwidthKb,
            peakRpm: metrics.peakRpm,
          },
        });
        upserted++;
      } catch (err) {
        this.logger.warn(`Failed to snapshot tenant ${tenant.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Metering snapshot: ${upserted}/${tenants.length} tenants in ${Date.now() - start}ms`);
  }

  /**
   * Compute resource usage (row counts + storage) for all active tenants.
   * Writes to today's snapshot (upsert — safe to run multiple times).
   * Runs daily at 2 AM UTC when DB load is lowest.
   *
   * Storage: summed from product_images.file_size — fast DB aggregate,
   * avoids slow MinIO API calls. Calibrated weekly if needed.
   */
  private async computeResourceUsage(): Promise<void> {
    const start = Date.now();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tenants = await this.getActiveTenants();

    // Process tenants in parallel batches of 5 to avoid DB overload
    const BATCH_SIZE = 5;
    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (tenant) => {
          try {
            const [productCount, bookingCount, customerCount, staffCount, storageResult] =
              await Promise.all([
                this.prisma.product.count({
                  where: { tenantId: tenant.id, deletedAt: null },
                }),
                this.prisma.booking.count({
                  where: { tenantId: tenant.id, deletedAt: null },
                }),
                this.prisma.customer.count({
                  where: { tenantId: tenant.id, deletedAt: null },
                }),
                this.prisma.tenantUser.count({
                  where: { tenantId: tenant.id, isActive: true },
                }),
                // Sum file sizes from product images — approximation without MinIO API
                this.prisma.productImage.aggregate({
                  where: { tenantId: tenant.id },
                  _sum: { fileSize: true },
                }),
              ]);

            const storageMb = Math.round(
              ((storageResult._sum.fileSize ?? 0) / (1024 * 1024)),
            );

            await (this.prisma as any).tenantUsageSnapshot.upsert({
              where: {
                tenantId_snapshotDate: {
                  tenantId: tenant.id,
                  snapshotDate: today,
                },
              },
              create: {
                tenantId: tenant.id,
                snapshotDate: today,
                productCount,
                bookingCount,
                customerCount,
                staffCount,
                storageUsedMb: storageMb,
              },
              update: {
                productCount,
                bookingCount,
                customerCount,
                staffCount,
                storageUsedMb: storageMb,
              },
            });
          } catch (err) {
            this.logger.warn(
              `Resource scan failed for tenant ${tenant.id}: ${(err as Error).message}`,
            );
          }
        }),
      );
    }

    this.logger.log(`Resource usage computed for ${tenants.length} tenants in ${Date.now() - start}ms`);
  }

  /**
   * Delete snapshot rows older than 90 days.
   * Runs weekly — keeps DB table small (~4,500 rows for 50 tenants).
   */
  private async cleanOldSnapshots(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    cutoff.setUTCHours(0, 0, 0, 0);

    const result = await (this.prisma as any).tenantUsageSnapshot.deleteMany({
      where: { snapshotDate: { lt: cutoff } },
    });

    this.logger.log(`Cleaned ${result.count} old metering snapshots (older than 90 days)`);
  }
}
