# Database Schema: `colors` + `variant_colors`

## Table: `colors`

Global color palette. Not tenant-scoped — shared across all tenants.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `name` | VARCHAR(50) | No | — | Color display name |
| `hex_code` | VARCHAR(7) | No | — | Hex code (e.g., #E53935) |
| `is_system` | BOOLEAN | No | `true` | System color vs custom |
| `tenant_id` | UUID | Yes | `NULL` | NULL for system, FK for custom |
| `created_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `colors_name_tenant_key` | `name, tenant_id` | UNIQUE |
| `colors_tenant_id_idx` | `tenant_id` | INDEX (where not null) |

### Notes

- System colors (`is_system = true`, `tenant_id = NULL`) are seeded once
- Custom tenant colors (`is_system = false`, `tenant_id = X`) are future feature
- Variant uses `variant_colors` junction table (see [product-variant.md](./product-variant.md))

---

## Prisma Model

```prisma
model Color {
  id           String          @id @default(uuid())
  name         String
  hexCode      String          @map("hex_code")
  isSystem     Boolean         @default(true) @map("is_system")
  tenantId     String?         @map("tenant_id")
  createdAt    DateTime        @default(now()) @map("created_at")

  mainVariants ProductVariant[] @relation("MainColor")
  variantColors VariantColor[]

  @@unique([name, tenantId])
  @@map("colors")
}
```

---

## Seed Data

30 system colors seeded on platform setup. See [color-variant-system.md](../features/color-variant-system.md) for the full palette.
