# Database Schema: `product_services`

## Table: `product_services`

One per product. Stores deposit, cleaning fee, backup size, and try-on settings.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` (unique) |
| `deposit_amount` | INTEGER | Yes | `NULL` | Security deposit |
| `cleaning_fee` | INTEGER | Yes | `NULL` | Cleaning charge |
| `backup_size_enabled` | BOOLEAN | No | `false` | Backup size feature on/off |
| `backup_size_fee` | INTEGER | Yes | `NULL` | Extra fee for backup size |
| `try_on_enabled` | BOOLEAN | No | `false` | Try-before-rent on/off |
| `try_on_fee` | INTEGER | Yes | `NULL` | Try-on charge |
| `try_on_duration_hours` | INT | Yes | `24` | Try-on duration |
| `try_on_credit_to_rental` | BOOLEAN | No | `false` | Credit try-on fee to rental |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_services_product_id_key` | `product_id` | UNIQUE |

---

## Prisma Model

```prisma
model ProductServices {
  id                    String   @id @default(uuid())
  tenantId              String   @map("tenant_id")
  productId             String   @unique @map("product_id")
  depositAmount         Int? @map("deposit_amount") @db.Int(12, 2)
  cleaningFee           Int? @map("cleaning_fee") @db.Int(12, 2)
  backupSizeEnabled     Boolean  @default(false) @map("backup_size_enabled")
  backupSizeFee         Int? @map("backup_size_fee") @db.Int(12, 2)
  tryOnEnabled          Boolean  @default(false) @map("try_on_enabled")
  tryOnFee              Int? @map("try_on_fee") @db.Int(12, 2)
  tryOnDurationHours    Int?     @default(24) @map("try_on_duration_hours")
  tryOnCreditToRental   Boolean  @default(false) @map("try_on_credit_to_rental")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  product               Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_services")
}
```
