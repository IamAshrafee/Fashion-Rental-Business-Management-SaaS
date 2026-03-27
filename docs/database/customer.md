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
| `address_line1` | VARCHAR(500) | Yes | `NULL` | Last used address line 1 |
| `address_line2` | VARCHAR(500) | Yes | `NULL` | Last used address line 2 |
| `city` | VARCHAR(100) | Yes | `NULL` | Last used city |
| `state` | VARCHAR(100) | Yes | `NULL` | Last used state/region |
| `postal_code` | VARCHAR(20) | Yes | `NULL` | Last used postal code |
| `country` | VARCHAR(2) | Yes | `NULL` | Country code |
| `address_extra` | JSONB | Yes | `NULL` | Tenant-specific address fields |
| `notes` | TEXT | Yes | `NULL` | Owner's internal notes |
| `total_bookings` | INT | No | `0` | Cached: total bookings |
| `total_spent` | INTEGER | No | `0` | Cached: total payments (excl. deposit) |
| `last_booking_at` | TIMESTAMP | Yes | `NULL` | Last booking date |
| `created_at` | TIMESTAMP | No | `NOW()` | First booking date |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `customers_tenant_phone_key` | `tenant_id, phone` | UNIQUE | Phone dedup per tenant |
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
  addressLine1   String?       @map("address_line1")
  addressLine2   String?       @map("address_line2")
  city           String?
  state          String?
  postalCode     String?       @map("postal_code")
  country        String?
  addressExtra   Json?         @map("address_extra") @db.JsonB
  notes          String?
  totalBookings  Int           @default(0) @map("total_bookings")
  totalSpent     Int           @default(0) @map("total_spent")
  lastBookingAt  DateTime?     @map("last_booking_at")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  bookings       Booking[]
  tags           CustomerTag[]

  @@unique([tenantId, phone])
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
