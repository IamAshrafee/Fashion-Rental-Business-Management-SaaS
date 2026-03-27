# Database Schema: `events` + `product_events`

## Table: `events`

Occasion tags (Wedding, Holud, etc.). Tenant-scoped with default seeding.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `name` | VARCHAR(100) | No | — | Event name |
| `slug` | VARCHAR(120) | No | — | URL slug |
| `display_order` | INT | No | `0` | Sort order |
| `is_active` | BOOLEAN | No | `true` | Show in filters |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `events_tenant_slug_key` | `tenant_id, slug` | UNIQUE |
| `events_tenant_id_idx` | `tenant_id` | INDEX |

---

## Table: `product_events`

Junction table — many-to-many between products and events.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `product_id` | UUID | No | — | FK → `products.id` |
| `event_id` | UUID | No | — | FK → `events.id` |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_events_product_event_key` | `product_id, event_id` | UNIQUE |
| `product_events_event_id_idx` | `event_id` | INDEX |

---

## Prisma Models

```prisma
model Event {
  id           String         @id @default(uuid())
  tenantId     String         @map("tenant_id")
  name         String
  slug         String
  displayOrder Int            @default(0) @map("display_order")
  isActive     Boolean        @default(true) @map("is_active")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  products     ProductEvent[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("events")
}

model ProductEvent {
  id        String  @id @default(uuid())
  productId String  @map("product_id")
  eventId   String  @map("event_id")

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  event     Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([productId, eventId])
  @@index([eventId])
  @@map("product_events")
}
```
