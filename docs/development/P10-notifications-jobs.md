# P10 — Notifications & Background Jobs (Backend)

| | |
|---|---|
| **Phase** | 2 — Core Business Modules |
| **Estimated Time** | 3–4 hours |
| **Requires** | P03 (auth, guards, tenant middleware) |
| **Unlocks** | None directly (consumed by P07–P09 via events) |

---

## REFERENCE DOCS

- `docs/features/notification-system.md` — Notification types, delivery channels
- `docs/background-jobs.md` — BullMQ setup, CRON registry, retry policy
- `docs/event-system.md` — EventEmitter2 patterns
- `docs/database/notification.md` — notifications table
- `docs/database/audit-log.md` — audit_logs table
- `docs/api/notification.md` — Notification API endpoints
- `docs/integrations/sms-provider.md` — SMS adapter
- `docs/integrations/_overview.md` — Provider adapter pattern

---

## SCOPE

### 1. Event System Setup (EventEmitter2)

```typescript
// Register event listeners that react to business events
@OnEvent('booking.created')
@OnEvent('booking.confirmed')
@OnEvent('booking.shipped')
@OnEvent('booking.overdue')
@OnEvent('payment.received')
@OnEvent('product.created')
// ...etc
```

Define all event types and payloads as TypeScript interfaces in `packages/types`.

### 2. Notification Module

**In-app notifications:**
- Create notification record (tenant_id, user_id, type, title, message, data, read status)
- `GET /api/v1/notifications` — paginated list (unread first)
- `PATCH /api/v1/notifications/:id/read` — mark as read
- `PATCH /api/v1/notifications/read-all` — mark all as read
- `GET /api/v1/notifications/unread-count` — badge count
- Real-time: WebSocket or SSE for live notification push (optional for v1, can use polling)

**SMS notifications:**
- SMS provider adapter interface
- At least one provider implementation (for now: log to console in dev mode)
- SMS sent on: booking confirmation, shipment, return reminder, overdue alert

### 3. BullMQ Setup

**Queue definitions:**
- `notifications` — SMS sending, notification creation
- `scheduler` — CRON jobs (overdue check, reminders, subscription check)
- `cleanup` — orphan image cleanup, trash auto-delete

**CRON job registry** (from `docs/background-jobs.md`):
- `booking.checkOverdue` — hourly, find delivered bookings past return date
- `booking.sendReturnReminders` — hourly, timezone-aware, SMS for returns due tomorrow
- `booking.autoExpirePending` — every 30 min, cancel pending bookings > 48h old
- `tenant.checkSubscriptions` — daily, check subscription expiry
- `image.cleanOrphans` — daily 3 AM UTC, delete unlinked images > 24h old
- `trash.autoDeleteExpired` — weekly, permanent delete trash items > 90 days old

**Retry policy:**
- notifications: 3 retries, exponential backoff (30s, 2min, 10min)
- scheduler: 2 retries, fixed 5 min delay
- cleanup: 1 retry, no delay

### 4. Audit Log Module

- Record all significant actions (create, update, delete, status change)
- Fields: tenant_id, user_id, action, entity, entity_id, changes (JSONB), ip_address, timestamp
- Auto-capture via Prisma middleware or decorator
- `GET /api/v1/audit-logs` — paginated, filterable by entity type and date range (owner only)

### 5. Failed Job Handling

- Dead letter storage: save failed jobs after all retries exhausted
- `GET /admin/failed-jobs` — admin view of failed jobs
- Retry failed job manually

### 6. Bull Board UI

- Mount Bull Board at `/admin/queues` (protected by admin auth)
- Visual monitoring of all queues, jobs, and failures

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | EventEmitter2 setup with typed events | Events fire and listeners execute |
| 2 | Notification CRUD API | Create, list, mark read, unread count |
| 3 | SMS adapter interface | Console logging in dev mode |
| 4 | BullMQ queues configured | 3 queues running |
| 5 | CRON jobs registered | All 6 jobs scheduled |
| 6 | Audit log module | Actions recorded and queryable |
| 7 | Failed job handling | Dead letter storage working |
| 8 | Bull Board UI | Accessible at /admin/queues |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| `EventEmitter2` typed events | P07, P08, P09 (emit business events) |
| `NotificationService.create()` | P07 (booking notifications), P08 (payment) |
| `SmsService.send()` | P07 (booking SMS), P09 (shipment SMS) |
| `AuditLogService.record()` | P04–P09 (all CRUD operations) |
| CRON job framework | Self-contained, runs automatically |
| Notification API endpoints | P12 (Owner dashboard — notification badge) |
