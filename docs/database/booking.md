# Database Schema: `bookings` + `date_blocks`

## Table: `bookings`

The primary transaction entity. Created when a guest completes checkout.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `booking_number` | VARCHAR(20) | No | — | Human-readable (e.g., #ORD-2026-0045) |
| `customer_id` | UUID | No | — | FK → `customers.id` |
| `status` | ENUM | No | `'pending'` | Booking lifecycle status |
| `payment_method` | ENUM | No | — | cod, bkash, nagad, sslcommerz |
| `payment_status` | ENUM | No | `'unpaid'` | unpaid, partial, paid |
| `subtotal` | INTEGER | No | — | Sum of item rental costs (integer, no decimals) |
| `total_fees` | INTEGER | No | `0` | Sum of cleaning + backup + try-on fees |
| `shipping_fee` | INTEGER | No | `0` | Delivery charge |
| `total_deposit` | INTEGER | No | `0` | Sum of item deposits |
| `grand_total` | INTEGER | No | — | subtotal + fees + shipping + deposit |
| `total_paid` | INTEGER | No | `0` | Amount paid so far |
| `delivery_name` | VARCHAR(200) | No | — | Customer name at checkout |
| `delivery_phone` | VARCHAR(20) | No | — | Customer phone |
| `delivery_alt_phone` | VARCHAR(20) | Yes | `NULL` | Alternate phone |
| `delivery_address_line1` | VARCHAR(500) | No | — | Address line 1 |
| `delivery_address_line2` | VARCHAR(500) | Yes | `NULL` | Address line 2 |
| `delivery_city` | VARCHAR(100) | No | — | City |
| `delivery_state` | VARCHAR(100) | Yes | `NULL` | State/province/region |
| `delivery_postal_code` | VARCHAR(20) | Yes | `NULL` | Postal/zip code |
| `delivery_country` | VARCHAR(2) | No | — | ISO 3166-1 country code |
| `delivery_extra` | JSONB | Yes | `NULL` | Tenant-specific address fields (e.g., thana, district) |
| `customer_notes` | TEXT | Yes | `NULL` | Special instructions |
| `internal_notes` | TEXT | Yes | `NULL` | Owner's internal notes |
| `tracking_number` | VARCHAR(100) | Yes | `NULL` | Courier tracking ID |
| `courier_provider` | VARCHAR(50) | Yes | `NULL` | Which courier used |
| `cancellation_reason` | TEXT | Yes | `NULL` | If cancelled, why |
| `cancelled_by` | ENUM | Yes | `NULL` | customer, owner |
| `confirmed_at` | TIMESTAMP | Yes | `NULL` | When confirmed |
| `shipped_at` | TIMESTAMP | Yes | `NULL` | When shipped |
| `delivered_at` | TIMESTAMP | Yes | `NULL` | When delivered |
| `returned_at` | TIMESTAMP | Yes | `NULL` | When returned |
| `completed_at` | TIMESTAMP | Yes | `NULL` | When fully completed |
| `deleted_at` | TIMESTAMP | Yes | `NULL` | Soft delete timestamp |
| `created_at` | TIMESTAMP | No | `NOW()` | Order placed time |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Enums

```prisma
enum BookingStatus {
  pending
  confirmed
  cancelled
  shipped
  delivered
  overdue
  returned
  inspected
  completed
}

enum PaymentMethod {
  cod
  bkash
  nagad
  sslcommerz
}

enum PaymentStatus {
  unpaid
  partial
  paid
}

enum CancelledBy {
  customer
  owner
}
```

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `bookings_tenant_number_key` | `tenant_id, booking_number` | UNIQUE | Number uniqueness |
| `bookings_status_idx` | `tenant_id, status` | INDEX | Status filtering |
| `bookings_created_at_idx` | `tenant_id, created_at DESC` | INDEX | Date sorting |
| `bookings_customer_id_idx` | `customer_id` | INDEX | Customer history |
| `bookings_active_idx` | `tenant_id, created_at DESC` | PARTIAL (WHERE deleted_at IS NULL) | Active bookings |

---

## Table: `date_blocks`

Tracks which dates are blocked (by booking or manually by owner) per product.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `start_date` | DATE | No | — | Block start |
| `end_date` | DATE | No | — | Block end |
| `block_type` | ENUM | No | — | booking, pending, manual |
| `booking_id` | UUID | Yes | `NULL` | FK → `bookings.id` (if type=booking/pending) |
| `reason` | VARCHAR(300) | Yes | `NULL` | Manual block reason |
| `created_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum BlockType {
  booking
  pending
  manual
}
```

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `date_blocks_product_dates_idx` | `product_id, start_date, end_date` | INDEX | Basic overlap checking |
| `date_blocks_booking_id_idx` | `booking_id` | INDEX | Link to booking |
| `date_blocks_overlap_gist` | `product_id, daterange(start_date, end_date)` | GiST | Efficient overlap queries |
| `no_overlapping_blocks` | `product_id, daterange(start_date, end_date)` | EXCLUDE (GiST) | Prevent concurrent double-booking |

> **Critical**: The `EXCLUDE` constraint requires `CREATE EXTENSION btree_gist;` and is defined via raw SQL migration (not Prisma schema).

---

## Prisma Models

```prisma
model Booking {
  id                 String         @id @default(uuid())
  tenantId           String         @map("tenant_id")
  bookingNumber      String         @map("booking_number")
  customerId         String         @map("customer_id")
  status             BookingStatus  @default(pending)
  paymentMethod      PaymentMethod  @map("payment_method")
  paymentStatus      PaymentStatus  @default(unpaid) @map("payment_status")
  subtotal           Int
  totalFees          Int            @default(0) @map("total_fees")
  shippingFee        Int            @default(0) @map("shipping_fee")
  totalDeposit       Int            @default(0) @map("total_deposit")
  grandTotal         Int            @map("grand_total")
  totalPaid          Int            @default(0) @map("total_paid")
  deliveryName       String         @map("delivery_name")
  deliveryPhone      String         @map("delivery_phone")
  deliveryAltPhone   String?        @map("delivery_alt_phone")
  deliveryAddressLine1 String       @map("delivery_address_line1")
  deliveryAddressLine2 String?      @map("delivery_address_line2")
  deliveryCity       String         @map("delivery_city")
  deliveryState      String?        @map("delivery_state")
  deliveryPostalCode String?        @map("delivery_postal_code")
  deliveryCountry    String         @map("delivery_country")
  deliveryExtra      Json?          @map("delivery_extra") @db.JsonB
  customerNotes      String?        @map("customer_notes")
  internalNotes      String?        @map("internal_notes")
  trackingNumber     String?        @map("tracking_number")
  courierProvider    String?        @map("courier_provider")
  cancellationReason String?        @map("cancellation_reason")
  cancelledBy        CancelledBy?   @map("cancelled_by")
  confirmedAt        DateTime?      @map("confirmed_at")
  shippedAt          DateTime?      @map("shipped_at")
  deliveredAt        DateTime?      @map("delivered_at")
  returnedAt         DateTime?      @map("returned_at")
  completedAt        DateTime?      @map("completed_at")
  deletedAt          DateTime?      @map("deleted_at")
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  tenant             Tenant         @relation(fields: [tenantId], references: [id])
  customer           Customer       @relation(fields: [customerId], references: [id])
  items              BookingItem[]
  payments           Payment[]
  dateBlocks         DateBlock[]

  @@unique([tenantId, bookingNumber])
  @@index([tenantId, status])
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([customerId])
  @@map("bookings")
}

model DateBlock {
  id          String    @id @default(uuid())
  tenantId    String    @map("tenant_id")
  productId   String    @map("product_id")
  startDate   DateTime  @map("start_date") @db.Date
  endDate     DateTime  @map("end_date") @db.Date
  blockType   BlockType @map("block_type")
  bookingId   String?   @map("booking_id")
  reason      String?
  createdAt   DateTime  @default(now()) @map("created_at")

  product     Product   @relation(fields: [productId], references: [id])
  booking     Booking?  @relation(fields: [bookingId], references: [id])

  @@index([productId, startDate, endDate])
  @@index([bookingId])
  @@index([tenantId])
  @@map("date_blocks")
}
```
