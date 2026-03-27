# Database Schema: `customers` + `customer_tags`

## Table: `customers`

Auto-created at first checkout. Identified by phone number within a tenant.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `full_name` | VARCHAR(200) | No | — | Customer name |
| `phone` | VARCHAR(20) | No | — | Primary phone (unique per tenant) |
| `alt_phone` | VARCHAR(20) | Yes | `NULL` | Alternate phone |
| `email` | VARCHAR(255) | Yes | `NULL` | Email (optional) |
| `address` | TEXT | Yes | `NULL` | Last used address |
| `area` | VARCHAR(100) | Yes | `NULL` | Last used area |
| `thana` | VARCHAR(100) | Yes | `NULL` | Last used thana |
| `district` | VARCHAR(100) | Yes | `NULL` | Last used district |
| `notes` | TEXT | Yes | `NULL` | Owner's internal notes |
| `total_bookings` | INT | No | `0` | Cached: total orders |
| `total_spent` | DECIMAL(12,2) | No | `0` | Cached: total payments (excl. deposit) |
| `last_booking_at` | TIMESTAMP | Yes | `NULL` | Last order date |
| `created_at` | TIMESTAMP | No | `NOW()` | First booking date |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `customers_tenant_phone_key` | `tenant_id, phone` | UNIQUE | Phone dedup per tenant |
| `customers_tenant_id_idx` | `tenant_id` | INDEX | Tenant filtering |
| `customers_name_idx` | `tenant_id, full_name` | INDEX | Name search |

---

## Table: `customer_tags`

Junction table for tagging customers (VIP, Frequent, etc.).

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `customer_id` | UUID | No | — | FK → `customers.id` |
| `tag` | VARCHAR(50) | No | — | Tag label |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `customer_tags_customer_tag_key` | `customer_id, tag` | UNIQUE |
| `customer_tags_tenant_id_idx` | `tenant_id` | INDEX |

---

## Prisma Models

```prisma
model Customer {
  id             String        @id @default(uuid())
  tenantId       String        @map("tenant_id")
  fullName       String        @map("full_name")
  phone          String
  altPhone       String?       @map("alt_phone")
  email          String?
  address        String?
  area           String?
  thana          String?
  district       String?
  notes          String?
  totalBookings  Int           @default(0) @map("total_bookings")
  totalSpent     Decimal       @default(0) @map("total_spent") @db.Decimal(12, 2)
  lastBookingAt  DateTime?     @map("last_booking_at")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  bookings       Booking[]
  tags           CustomerTag[]

  @@unique([tenantId, phone])
  @@index([tenantId])
  @@index([tenantId, fullName])
  @@map("customers")
}

model CustomerTag {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  customerId String   @map("customer_id")
  tag        String

  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([customerId, tag])
  @@index([tenantId])
  @@map("customer_tags")
}
```
