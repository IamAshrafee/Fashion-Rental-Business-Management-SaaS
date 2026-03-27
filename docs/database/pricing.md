# Database Schema: `product_pricing`

## Table: `product_pricing`

One per product. Stores the pricing mode and all mode-specific values.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` (unique) |
| `mode` | ENUM | No | — | one_time, per_day, percentage |
| `rental_price` | INTEGER | Yes | `NULL` | Fixed rental price (one_time) |
| `included_days` | INT | Yes | `NULL` | Days included in base price (one_time/percentage) |
| `price_per_day` | INTEGER | Yes | `NULL` | Per day rate (per_day mode) |
| `minimum_days` | INT | Yes | `1` | Minimum rental days (per_day mode) |
| `retail_price` | INTEGER | Yes | `NULL` | Retail/purchase price (percentage mode) |
| `rental_percentage` | DECIMAL(5,2) | Yes | `NULL` | Percentage of retail (percentage mode) |
| `calculated_price` | INTEGER | Yes | `NULL` | Auto-calculated: retail × percentage |
| `price_override` | INTEGER | Yes | `NULL` | Manual override of calculated price |
| `min_internal_price` | INTEGER | Yes | `NULL` | Internal minimum (staff visible) |
| `max_discount_price` | INTEGER | Yes | `NULL` | Maximum discount ceiling |
| `extended_rental_rate` | INTEGER | Yes | `NULL` | Per day rate for extra days |
| `late_fee_type` | ENUM | Yes | `NULL` | fixed, percentage |
| `late_fee_amount` | INTEGER | Yes | `NULL` | Late fee per day (fixed) |
| `late_fee_percentage` | DECIMAL(5,2) | Yes | `NULL` | Late fee % of retail (percentage) |
| `max_late_fee` | INTEGER | Yes | `NULL` | Maximum late fee cap |
| `shipping_mode` | ENUM | Yes | `NULL` | free, flat, area_based |
| `shipping_fee` | INTEGER | Yes | `NULL` | Flat shipping fee |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum PricingMode {
  one_time
  per_day
  percentage
}

enum LateFeeType {
  fixed
  percentage
}

enum ShippingMode {
  free
  flat
  area_based
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_pricing_product_id_key` | `product_id` | UNIQUE |
| `product_pricing_tenant_id_idx` | `tenant_id` | INDEX |

---

## Prisma Model

```prisma
model ProductPricing {
  id                  String        @id @default(uuid())
  tenantId            String        @map("tenant_id")
  productId           String        @unique @map("product_id")
  mode                PricingMode
  rentalPrice         Int?      @map("rental_price") @db.Int(12, 2)
  includedDays        Int?          @map("included_days")
  pricePerDay         Int?      @map("price_per_day") @db.Int(12, 2)
  minimumDays         Int?          @default(1) @map("minimum_days")
  retailPrice         Int?      @map("retail_price") @db.Int(12, 2)
  rentalPercentage    Int?      @map("rental_percentage") @db.Int(5, 2)
  calculatedPrice     Int?      @map("calculated_price") @db.Int(12, 2)
  priceOverride       Int?      @map("price_override") @db.Int(12, 2)
  minInternalPrice    Int?      @map("min_internal_price") @db.Int(12, 2)
  maxDiscountPrice    Int?      @map("max_discount_price") @db.Int(12, 2)
  extendedRentalRate  Int?      @map("extended_rental_rate") @db.Int(12, 2)
  lateFeeType         LateFeeType?  @map("late_fee_type")
  lateFeeAmount       Int?      @map("late_fee_amount") @db.Int(12, 2)
  lateFeePercentage   Int?      @map("late_fee_percentage") @db.Int(5, 2)
  maxLateFee          Int?      @map("max_late_fee") @db.Int(12, 2)
  shippingMode        ShippingMode? @map("shipping_mode")
  shippingFee         Int?      @map("shipping_fee") @db.Int(12, 2)
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  product             Product       @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("product_pricing")
}
```

---

## Notes

- Pricing and logistics combined in one table since they're always read together
- `calculated_price` is auto-derived: `retail_price × rental_percentage / 100`
- `price_override` takes precedence over `calculated_price` if set
- `min_internal_price` is never exposed to guest API responses
