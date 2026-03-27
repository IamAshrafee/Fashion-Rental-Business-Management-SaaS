# Background Jobs & CRON Registry

## Architecture

BullMQ with Redis for all background jobs. Provides retry logic, delayed jobs, priority queues, and monitoring.

---

## Setup

```typescript
// backend/src/modules/jobs/jobs.module.ts
@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'redis', port: 6379 } }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'scheduler' },
      { name: 'cleanup' },
    ),
  ],
})
export class JobsModule {}
```

---

## Queue Architecture

```
┌──────────────────────────────────────────────┐
│                 Redis                         │
│                                              │
│  Queue: notifications                        │
│    ├── sms.send                              │
│    ├── notification.create                   │
│    └── email.send (future)                   │
│                                              │
│  Queue: scheduler                            │
│    ├── booking.checkOverdue                  │
│    ├── booking.sendReturnReminders           │
│    ├── booking.autoExpirePending             │
│    └── tenant.checkSubscriptions             │
│                                              │
│  Queue: cleanup                              │
│    ├── image.cleanOrphans                    │
│    └── trash.autoDeleteExpired               │
│                                              │
└──────────────────────────────────────────────┘
```

---

## CRON Job Registry

| Job | Queue | Schedule (UTC) | Description |
|---|---|---|---|
| `booking.checkOverdue` | scheduler | Every hour | Find delivered bookings past return date → mark overdue |
| `booking.sendReturnReminders` | scheduler | Every hour | Find tenants where local time = 9 AM, send SMS for returns due tomorrow |
| `booking.autoExpirePending` | scheduler | Every 30 min | Cancel pending bookings older than 48h (configurable per tenant) |
| `tenant.checkSubscriptions` | scheduler | Daily 00:00 UTC | Check subscription expiry → grace period → suspend |
| `image.cleanOrphans` | cleanup | Daily 03:00 UTC | Find MinIO images not linked to any product > 24h old → delete |
| `trash.autoDeleteExpired` | cleanup | Weekly Sunday 04:00 UTC | Permanently delete trash items older than 90 days (future) |

---

## Job Definitions

### Overdue Check

```typescript
@Processor('scheduler')
export class SchedulerProcessor {
  @Process('booking.checkOverdue')
  async checkOverdue() {
    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        status: 'delivered',
        endDate: { lt: new Date() },
      },
      include: { tenant: true },
    });

    for (const booking of overdueBookings) {
      await this.bookingService.markOverdue(booking.id);
      // Event emitted → listeners handle SMS, notification
    }
  }
}
```

### Return Reminders (Timezone-Aware)

```typescript
@Process('booking.sendReturnReminders')
async sendReturnReminders() {
  const now = new Date();
  // Find tenants where local time is approximately 9:00 AM
  const tenants = await this.tenantService.findByLocalHour(now, 9);

  for (const tenant of tenants) {
    const tomorrow = addDays(now, 1);
    const bookingsDueTomorrow = await this.prisma.booking.findMany({
      where: {
        tenantId: tenant.id,
        status: 'delivered',
        endDate: tomorrow,
      },
    });

    for (const booking of bookingsDueTomorrow) {
      this.eventEmitter.emit('booking.returnReminder', booking);
    }
  }
}
```

---

## Retry Policy

| Queue | Max Retries | Backoff | Delay |
|---|---|---|---|
| notifications | 3 | Exponential | 30s, 2min, 10min |
| scheduler | 2 | Fixed | 5 min |
| cleanup | 1 | None | — |

---

## Monitoring

**Bull Board** — web UI for monitoring all queues.

```typescript
// Mount Bull Board at /admin/queues (protected by admin auth)
const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(notificationsQueue),
    new BullMQAdapter(schedulerQueue),
    new BullMQAdapter(cleanupQueue),
  ],
  serverAdapter,
});
```

### Alerts

| Condition | Alert |
|---|---|
| Queue depth > 100 jobs | Telegram notification |
| Failed job count > 10 in 1 hour | Telegram + SMS |
| SMS delivery rate < 90% | Telegram notification |

---

## Failed Job Handling

```typescript
@OnQueueFailed()
async onFailed(job: Job, error: Error) {
  logger.error(`Job ${job.name} failed`, {
    jobId: job.id,
    data: job.data,
    error: error.message,
    attempt: job.attemptsMade,
  });

  if (job.attemptsMade >= job.opts.attempts) {
    // All retries exhausted — log to dead letter
    await this.prisma.failedJob.create({
      data: {
        queue: job.queueName,
        jobName: job.name,
        payload: job.data,
        error: error.message,
        failedAt: new Date(),
      },
    });
  }
}
```
