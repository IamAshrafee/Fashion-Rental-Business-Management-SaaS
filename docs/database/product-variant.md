# Database Schema: `product_variants`

## Table: `product_variants`

Each product has one or more color variants. Each variant has its own main color, identical colors, and images.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `variant_name` | VARCHAR(100) | Yes | `NULL` | Optional label (e.g., "Ivory Gold") |
| `main_color_id` | UUID | No | — | FK → `colors.id` |
| `sequence` | INT | No | `0` | Display order (0 = default/first variant) |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `product_variants_product_id_idx` | `product_id` | INDEX | Find variants for a product |
| `product_variants_tenant_id_idx` | `tenant_id` | INDEX | Tenant filtering |
| `product_variants_main_color_idx` | `main_color_id` | INDEX | Color lookup |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `product` | belongs-to | `products` |
| `mainColor` | belongs-to | `colors` |
| `identicalColors` | many-to-many | `colors` (via `variant_colors`) |
| `images` | has-many | `product_images` |

---

## Table: `variant_colors`

Junction table for the many-to-many relationship between variants and their identical colors.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `variant_id` | UUID | No | — | FK → `product_variants.id` |
| `color_id` | UUID | No | — | FK → `colors.id` |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `variant_colors_variant_color_key` | `variant_id, color_id` | UNIQUE |
| `variant_colors_color_id_idx` | `color_id` | INDEX |

---

## Prisma Models

```prisma
model ProductVariant {
  id            String         @id @default(uuid())
  tenantId      String         @map("tenant_id")
  productId     String         @map("product_id")
  variantName   String?        @map("variant_name")
  mainColorId   String         @map("main_color_id")
  sequence      Int            @default(0)
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  product       Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  mainColor     Color          @relation("MainColor", fields: [mainColorId], references: [id])
  identicalColors VariantColor[]
  images        ProductImage[]

  @@index([productId])
  @@index([tenantId])
  @@map("product_variants")
}

model VariantColor {
  id        String         @id @default(uuid())
  variantId String         @map("variant_id")
  colorId   String         @map("color_id")

  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  color     Color          @relation(fields: [colorId], references: [id])

  @@unique([variantId, colorId])
  @@index([colorId])
  @@map("variant_colors")
}
```
