# Database Schema: `product_sizes` + related tables

## Overview

The size system uses 4 modes. The schema stores all modes in a flexible structure using one main table plus child tables for measurements and multi-part sizes.

---

## Table: `product_sizes`

One per product. Stores the mode and mode-specific data.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` (unique) |
| `mode` | ENUM | No | — | standard, measurement, multi_part, free |
| `free_size_type` | ENUM | Yes | `NULL` | free_size, adjustable, no_size (only if mode=free) |
| `available_sizes` | TEXT[] | Yes | `NULL` | Array of size labels (only if mode=standard) |
| `size_chart_url` | VARCHAR(500) | Yes | `NULL` | Size chart image URL |
| `main_display_size` | VARCHAR(20) | Yes | `NULL` | Display size for multi-part (e.g., "M") |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum SizeMode {
  standard
  measurement
  multi_part
  free
}

enum FreeSizeType {
  free_size
  adjustable
  no_size
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_sizes_product_id_key` | `product_id` | UNIQUE |

---

## Table: `size_measurements`

For mode=measurement: individual measurement fields.
For mode=multi_part: measurements within a part.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `product_size_id` | UUID | No | — | FK → `product_sizes.id` |
| `part_id` | UUID | Yes | `NULL` | FK → `size_parts.id` (NULL if mode=measurement) |
| `label` | VARCHAR(50) | No | — | e.g., "Chest", "Waist" |
| `value` | VARCHAR(50) | No | — | e.g., "38", "30-32" |
| `unit` | VARCHAR(10) | No | `'inch'` | inch or cm |
| `sequence` | INT | No | `0` | Display order |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `size_measurements_product_size_idx` | `product_size_id` | INDEX |
| `size_measurements_part_id_idx` | `part_id` | INDEX |

---

## Table: `size_parts`

For mode=multi_part only. Each part of a multi-piece outfit.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `product_size_id` | UUID | No | — | FK → `product_sizes.id` |
| `part_name` | VARCHAR(50) | No | — | e.g., "Top", "Bottom", "Skirt" |
| `sequence` | INT | No | `0` | Display order |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `size_parts_product_size_idx` | `product_size_id` | INDEX |

---

## Prisma Models

```prisma
model ProductSize {
  id              String           @id @default(uuid())
  tenantId        String           @map("tenant_id")
  productId       String           @unique @map("product_id")
  mode            SizeMode
  freeSizeType    FreeSizeType?    @map("free_size_type")
  availableSizes  String[]         @map("available_sizes")
  sizeChartUrl    String?          @map("size_chart_url")
  mainDisplaySize String?          @map("main_display_size")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  product         Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  measurements    SizeMeasurement[]
  parts           SizePart[]

  @@map("product_sizes")
}

model SizeMeasurement {
  id            String      @id @default(uuid())
  productSizeId String      @map("product_size_id")
  partId        String?     @map("part_id")
  label         String
  value         String
  unit          String      @default("inch")
  sequence      Int         @default(0)

  productSize   ProductSize @relation(fields: [productSizeId], references: [id], onDelete: Cascade)
  part          SizePart?   @relation(fields: [partId], references: [id], onDelete: Cascade)

  @@index([productSizeId])
  @@map("size_measurements")
}

model SizePart {
  id            String           @id @default(uuid())
  productSizeId String           @map("product_size_id")
  partName      String           @map("part_name")
  sequence      Int              @default(0)

  productSize   ProductSize      @relation(fields: [productSizeId], references: [id], onDelete: Cascade)
  measurements  SizeMeasurement[]

  @@index([productSizeId])
  @@map("size_parts")
}
```
