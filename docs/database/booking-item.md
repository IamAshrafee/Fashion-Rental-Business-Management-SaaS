# Database Schema: `booking_items` + `damage_reports`

## Table: `booking_items`

Individual products within a booking. Each item has its own dates, pricing, and deposit.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `booking_id` | UUID | No | — | FK → `bookings.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `variant_id` | UUID | No | — | FK → `product_variants.id` |
| `product_name` | VARCHAR(200) | No | — | Snapshot: product name at booking time |
| `variant_name` | VARCHAR(100) | Yes | `NULL` | Snapshot: variant name |
| `color_name` | VARCHAR(50) | No | — | Snapshot: main color name |
| `size_info` | VARCHAR(100) | Yes | `NULL` | Snapshot: selected size |
| `featured_image_url` | VARCHAR(500) | No | — | Snapshot: variant image |
| `start_date` | DATE | No | — | Rental start |
| `end_date` | DATE | No | — | Rental end |
| `rental_days` | INT | No | — | Calculated duration |
| `base_rental` | DECIMAL(12,2) | No | — | Base rental price (snapshot) |
| `extended_days` | INT | No | `0` | Extra days beyond base |
| `extended_cost` | DECIMAL(12,2) | No | `0` | Extended days charge |
| `deposit_amount` | DECIMAL(12,2) | No | `0` | Security deposit |
| `deposit_status` | ENUM | No | `'pending'` | Deposit lifecycle status |
| `deposit_refund_amount` | DECIMAL(12,2) | Yes | `NULL` | Actual refund amount |
| `deposit_refund_date` | TIMESTAMP | Yes | `NULL` | When refund was processed |
| `deposit_refund_method` | VARCHAR(50) | Yes | `NULL` | How refund was sent |
| `cleaning_fee` | DECIMAL(12,2) | No | `0` | Cleaning charge |
| `backup_size` | VARCHAR(20) | Yes | `NULL` | Backup size selected |
| `backup_size_fee` | DECIMAL(12,2) | No | `0` | Backup size charge |
| `try_on_fee` | DECIMAL(12,2) | No | `0` | Try-on charge |
| `try_on_credited` | BOOLEAN | No | `false` | Try-on credited to rental |
| `item_total` | DECIMAL(12,2) | No | — | Total for this item |
| `late_fee` | DECIMAL(12,2) | No | `0` | Accumulated late fee |
| `late_days` | INT | No | `0` | Days returned late |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum DepositStatus {
  pending
  collected
  held
  refunded
  partially_refunded
  forfeited
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `booking_items_booking_id_idx` | `booking_id` | INDEX |
| `booking_items_product_id_idx` | `product_id` | INDEX |
| `booking_items_tenant_id_idx` | `tenant_id` | INDEX |

---

## Table: `damage_reports`

Created when owner reports damage on a returned item.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `booking_item_id` | UUID | No | — | FK → `booking_items.id` |
| `damage_level` | ENUM | No | — | none, minor, moderate, severe, destroyed, lost |
| `description` | TEXT | No | — | Damage description |
| `estimated_repair_cost` | DECIMAL(12,2) | Yes | `NULL` | Repair estimate |
| `deduction_amount` | DECIMAL(12,2) | No | `0` | Amount deducted from deposit |
| `additional_charge` | DECIMAL(12,2) | No | `0` | Amount beyond deposit |
| `photos` | TEXT[] | Yes | `NULL` | Array of photo URLs |
| `reported_by` | UUID | No | — | FK → `users.id` |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum DamageLevel {
  none
  minor
  moderate
  severe
  destroyed
  lost
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `damage_reports_booking_item_idx` | `booking_item_id` | INDEX |
| `damage_reports_tenant_id_idx` | `tenant_id` | INDEX |

---

## Prisma Models

```prisma
model BookingItem {
  id                  String        @id @default(uuid())
  tenantId            String        @map("tenant_id")
  bookingId           String        @map("booking_id")
  productId           String        @map("product_id")
  variantId           String        @map("variant_id")
  productName         String        @map("product_name")
  variantName         String?       @map("variant_name")
  colorName           String        @map("color_name")
  sizeInfo            String?       @map("size_info")
  featuredImageUrl    String        @map("featured_image_url")
  startDate           DateTime      @map("start_date") @db.Date
  endDate             DateTime      @map("end_date") @db.Date
  rentalDays          Int           @map("rental_days")
  baseRental          Decimal       @map("base_rental") @db.Decimal(12, 2)
  extendedDays        Int           @default(0) @map("extended_days")
  extendedCost        Decimal       @default(0) @map("extended_cost") @db.Decimal(12, 2)
  depositAmount       Decimal       @default(0) @map("deposit_amount") @db.Decimal(12, 2)
  depositStatus       DepositStatus @default(pending) @map("deposit_status")
  depositRefundAmount Decimal?      @map("deposit_refund_amount") @db.Decimal(12, 2)
  depositRefundDate   DateTime?     @map("deposit_refund_date")
  depositRefundMethod String?       @map("deposit_refund_method")
  cleaningFee         Decimal       @default(0) @map("cleaning_fee") @db.Decimal(12, 2)
  backupSize          String?       @map("backup_size")
  backupSizeFee       Decimal       @default(0) @map("backup_size_fee") @db.Decimal(12, 2)
  tryOnFee            Decimal       @default(0) @map("try_on_fee") @db.Decimal(12, 2)
  tryOnCredited       Boolean       @default(false) @map("try_on_credited")
  itemTotal           Decimal       @map("item_total") @db.Decimal(12, 2)
  lateFee             Decimal       @default(0) @map("late_fee") @db.Decimal(12, 2)
  lateDays            Int           @default(0) @map("late_days")
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  booking             Booking       @relation(fields: [bookingId], references: [id])
  product             Product       @relation(fields: [productId], references: [id])
  damageReport        DamageReport?

  @@index([bookingId])
  @@index([productId])
  @@index([tenantId])
  @@map("booking_items")
}

model DamageReport {
  id                  String      @id @default(uuid())
  tenantId            String      @map("tenant_id")
  bookingItemId       String      @unique @map("booking_item_id")
  damageLevel         DamageLevel @map("damage_level")
  description         String
  estimatedRepairCost Decimal?    @map("estimated_repair_cost") @db.Decimal(12, 2)
  deductionAmount     Decimal     @default(0) @map("deduction_amount") @db.Decimal(12, 2)
  additionalCharge    Decimal     @default(0) @map("additional_charge") @db.Decimal(12, 2)
  photos              String[]
  reportedBy          String      @map("reported_by")
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  bookingItem         BookingItem @relation(fields: [bookingItemId], references: [id])

  @@index([tenantId])
  @@map("damage_reports")
}
```

---

## Notes

- Booking items store **snapshots** of product data at booking time. This ensures price changes don't affect existing orders.
- Deposit lifecycle is tracked per item, not per booking (each product has its own deposit).
- Damage reports are one-per-booking-item (one product can have one damage assessment per rental).
