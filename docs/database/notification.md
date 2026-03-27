# Database Schema: `notifications`

## Table: `notifications`

In-app notifications for the owner portal. SMS notifications are sent directly and not stored here.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `user_id` | UUID | Yes | `NULL` | FK → `users.id` (recipient, NULL = all tenant users) |
| `type` | VARCHAR(50) | No | — | Notification type (new_booking, overdue, etc.) |
| `title` | VARCHAR(200) | No | — | Short title |
| `message` | TEXT | No | — | Notification body |
| `data` | JSONB | Yes | `NULL` | Related entity IDs, action URLs |
| `is_read` | BOOLEAN | No | `false` | Read status |
| `read_at` | TIMESTAMP | Yes | `NULL` | When read |
| `created_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `notifications_tenant_user_idx` | `tenant_id, user_id` | INDEX | User's notifications |
| `notifications_is_read_idx` | `tenant_id, is_read` | INDEX | Unread count |
| `notifications_created_idx` | `tenant_id, created_at` | INDEX | Chronological listing |

### Cleanup

Notifications older than 30 days are auto-deleted via a scheduled job.

---

## Prisma Model

```prisma
model Notification {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String?  @map("user_id")
  type      String
  title     String
  message   String
  data      Json?
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([tenantId, userId])
  @@index([tenantId, isRead])
  @@index([tenantId, createdAt])
  @@map("notifications")
}
```
