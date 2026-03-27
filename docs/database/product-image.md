# Database Schema: `product_images`

## Table: `product_images`

Stores image metadata for product variants. Actual files are in MinIO; this table holds URLs and sequencing.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `variant_id` | UUID | No | — | FK → `product_variants.id` |
| `url` | VARCHAR(500) | No | — | Full-size image URL (WebP, MinIO) |
| `thumbnail_url` | VARCHAR(500) | No | — | 400×400 thumbnail URL (MinIO) |
| `is_featured` | BOOLEAN | No | `false` | Is this the variant's featured image |
| `sequence` | INT | No | `0` | Display order (featured = 0) |
| `original_name` | VARCHAR(255) | Yes | `NULL` | Original filename at upload |
| `file_size` | INT | Yes | `NULL` | File size in bytes |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `product_images_variant_id_idx` | `variant_id` | INDEX | Find images for variant |
| `product_images_tenant_id_idx` | `tenant_id` | INDEX | Tenant filtering |
| `product_images_sequence_idx` | `variant_id, sequence` | INDEX | Ordered retrieval |

### Constraints

- Each variant must have exactly one image with `is_featured = true`
- Enforced at application level (not DB constraint)

---

## Prisma Model

```prisma
model ProductImage {
  id           String         @id @default(uuid())
  tenantId     String         @map("tenant_id")
  variantId    String         @map("variant_id")
  url          String
  thumbnailUrl String         @map("thumbnail_url")
  isFeatured   Boolean        @default(false) @map("is_featured")
  sequence     Int            @default(0)
  originalName String?        @map("original_name")
  fileSize     Int?           @map("file_size")
  createdAt    DateTime       @default(now()) @map("created_at")

  variant      ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@index([variantId])
  @@index([tenantId])
  @@index([variantId, sequence])
  @@map("product_images")
}
```

---

## MinIO Storage Structure

```
bucket: closetrent-uploads
path:   /tenant-{tenantId}/products/{productId}/{variantId}/
files:  {uuid}.webp           ← full size
        {uuid}_thumb.webp     ← thumbnail
```
