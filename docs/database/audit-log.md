# Database Schema: `audit_logs`

## Table: `audit_logs`

Tracks all significant actions performed by users for accountability and debugging.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `user_id` | UUID | No | — | FK → `users.id` (who did the action) |
| `action` | VARCHAR(100) | No | — | Action type (e.g., "order.status_change") |
| `entity_type` | VARCHAR(50) | No | — | Entity affected (e.g., "booking", "product") |
| `entity_id` | UUID | No | — | ID of the affected entity |
| `old_values` | JSONB | Yes | `NULL` | Previous state |
| `new_values` | JSONB | Yes | `NULL` | New state |
| `ip_address` | VARCHAR(45) | Yes | `NULL` | Request IP |
| `user_agent` | VARCHAR(500) | Yes | `NULL` | Browser/device |
| `created_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `audit_logs_tenant_id_idx` | `tenant_id` | INDEX | Tenant filtering |
| `audit_logs_user_id_idx` | `user_id` | INDEX | User activity |
| `audit_logs_entity_idx` | `entity_type, entity_id` | INDEX | Entity history |
| `audit_logs_created_idx` | `tenant_id, created_at` | INDEX | Chronological |

### Common Action Types

| Action | Description |
|---|---|
| `product.create` | Product created |
| `product.update` | Product updated |
| `product.delete` | Product soft deleted |
| `booking.status_change` | Order status changed |
| `booking.price_adjust` | Order price modified |
| `payment.record` | Payment manually recorded |
| `deposit.refund` | Deposit refund processed |
| `damage.report` | Damage report filed |
| `staff.add` | Staff member added |
| `staff.remove` | Staff member removed |
| `settings.update` | Store settings changed |

---

## Prisma Model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  userId     String   @map("user_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  oldValues  Json?    @map("old_values")
  newValues  Json?    @map("new_values")
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at")

  user       User     @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@index([userId])
  @@index([entityType, entityId])
  @@index([tenantId, createdAt])
  @@map("audit_logs")
}
```

---

## Notes

- Audit logs are append-only — never updated or deleted
- Used for staff accountability and dispute resolution
- `old_values` and `new_values` store JSON diffs for changes
- Retention: Keep indefinitely (or configurable per tenant in future)
