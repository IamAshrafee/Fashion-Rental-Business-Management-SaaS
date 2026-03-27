# Database Schema: `product_detail_headers` + `product_detail_entries`

## Table: `product_detail_headers`

Groups of key-value details (e.g., "Fabric Details", "Care Instructions").

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `header_name` | VARCHAR(100) | No | — | Section header |
| `sequence` | INT | No | `0` | Display order |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_detail_headers_product_idx` | `product_id` | INDEX |

---

## Table: `product_detail_entries`

Key-value pairs under a header.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `header_id` | UUID | No | — | FK → `product_detail_headers.id` |
| `key` | VARCHAR(100) | No | — | Detail label (e.g., "Material") |
| `value` | VARCHAR(500) | No | — | Detail value (e.g., "Banarasi Silk") |
| `sequence` | INT | No | `0` | Display order |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_detail_entries_header_idx` | `header_id` | INDEX |

---

## Prisma Models

```prisma
model ProductDetailHeader {
  id         String                @id @default(uuid())
  tenantId   String                @map("tenant_id")
  productId  String                @map("product_id")
  headerName String                @map("header_name")
  sequence   Int                   @default(0)
  createdAt  DateTime              @default(now()) @map("created_at")
  updatedAt  DateTime              @updatedAt @map("updated_at")

  product    Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  entries    ProductDetailEntry[]

  @@index([productId])
  @@map("product_detail_headers")
}

model ProductDetailEntry {
  id       String              @id @default(uuid())
  headerId String              @map("header_id")
  key      String
  value    String
  sequence Int                 @default(0)

  header   ProductDetailHeader @relation(fields: [headerId], references: [id], onDelete: Cascade)

  @@index([headerId])
  @@map("product_detail_entries")
}
```
