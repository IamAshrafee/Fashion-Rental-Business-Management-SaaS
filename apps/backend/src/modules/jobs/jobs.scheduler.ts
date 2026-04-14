import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobsService } from './jobs.service';

/**
 * Registers repeatable (CRON-like) jobs in BullMQ on app startup.
 * Runs idempotently — BullMQ deduplicates by job key.
 */
@Injectable()
export class JobsScheduler implements OnModuleInit {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(private readonly jobsService: JobsService) {}

  async onModuleInit() {
    try {
      await this.registerCronJobs();
      this.logger.log('CRON jobs registered successfully');
    } catch (err) {
      // Don't crash the app if Redis is unavailable on startup
      this.logger.warn(`Failed to register CRON jobs: ${(err as Error).message}`);
    }
  }

  private async registerCronJobs() {
    const { schedulerQueue, cleanupQueue, fulfillmentQueue } = this.jobsService;

    // Remove old repeatable jobs before re-registering (for clean updates)
    const schedulerRepeatable = await schedulerQueue.getRepeatableJobs();
    for (const job of schedulerRepeatable) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }

    const cleanupRepeatable = await cleanupQueue.getRepeatableJobs();
    for (const job of cleanupRepeatable) {
      await cleanupQueue.removeRepeatableByKey(job.key);
    }

    const fulfillmentRepeatable = await fulfillmentQueue.getRepeatableJobs();
    for (const job of fulfillmentRepeatable) {
      await fulfillmentQueue.removeRepeatableByKey(job.key);
    }

    // ── Scheduler Queue CRON Jobs ─────────────────────────────────────────

    // Every hour: find delivered bookings past return date → mark overdue
    await schedulerQueue.add(
      'booking.checkOverdue',
      {},
      {
        repeat: { pattern: '0 * * * *' }, // Every hour
        jobId: 'cron:booking.checkOverdue',
      },
    );

    // Every hour: send return reminders for bookings due tomorrow
    await schedulerQueue.add(
      'booking.sendReturnReminders',
      {},
      {
        repeat: { pattern: '15 * * * *' }, // Every hour at :15
        jobId: 'cron:booking.sendReturnReminders',
      },
    );

    // Every 30 min: auto-cancel stale pending bookings
    await schedulerQueue.add(
      'booking.autoExpirePending',
      {},
      {
        repeat: { pattern: '*/30 * * * *' }, // Every 30 minutes
        jobId: 'cron:booking.autoExpirePending',
      },
    );

    // Daily midnight UTC: check subscription expiry
    await schedulerQueue.add(
      'tenant.checkSubscriptions',
      {},
      {
        repeat: { pattern: '0 0 * * *' }, // Daily at midnight UTC
        jobId: 'cron:tenant.checkSubscriptions',
      },
    );

    // ── Fulfillment Queue CRON Jobs ───────────────────────────────────────

    // Every 15 min: poll Pathao API for courier status updates
    await fulfillmentQueue.add(
      'fulfillment.pollCourierStatus',
      {},
      {
        repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
        jobId: 'cron:fulfillment.pollCourierStatus',
      },
    );

    // Every 6 hours: check for pickups stuck 3+ days → auto-mark as error
    await fulfillmentQueue.add(
      'fulfillment.checkStuckPickups',
      {},
      {
        repeat: { pattern: '0 */6 * * *' }, // Every 6 hours
        jobId: 'cron:fulfillment.checkStuckPickups',
      },
    );

    // ── Cleanup Queue CRON Jobs ───────────────────────────────────────────

    // Daily 3 AM UTC: clean notifications older than 30 days
    await cleanupQueue.add(
      'notification.cleanOld',
      {},
      {
        repeat: { pattern: '0 3 * * *' }, // Daily 3 AM UTC
        jobId: 'cron:notification.cleanOld',
      },
    );

    // Weekly Sunday 4 AM UTC: permanently delete trash (90+ days)
    await cleanupQueue.add(
      'trash.autoDeleteExpired',
      {},
      {
        repeat: { pattern: '0 4 * * 0' }, // Weekly Sunday 4 AM UTC
        jobId: 'cron:trash.autoDeleteExpired',
      },
    );

    // Every 2 hours: recalculate product popularity scores from storefront events
    await schedulerQueue.add(
      'product.recalculatePopularity',
      {},
      {
        repeat: { pattern: '0 */2 * * *' }, // Every 2 hours
        jobId: 'cron:product.recalculatePopularity',
      },
    );

    this.logger.log('Registered 9 CRON jobs: 5 scheduler, 2 fulfillment, 2 cleanup');
  }
}
