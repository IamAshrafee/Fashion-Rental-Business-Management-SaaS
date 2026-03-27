# Database Schema: `categories` + `subcategories`

## Table: `categories`

Top-level product classification. Tenant-scoped with default seeding.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `name` | VARCHAR(100) | No | — | Category name |
| `slug` | VARCHAR(120) | No | — | URL slug |
| `icon` | VARCHAR(100) | Yes | `NULL` | Icon name or URL |
| `display_order` | INT | No | `0` | Sort order |
| `is_active` | BOOLEAN | No | `true` | Show in filters |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `categories_tenant_slug_key` | `tenant_id, slug` | UNIQUE |
| `categories_tenant_id_idx` | `tenant_id` | INDEX |

---

## Table: `subcategories`

Second-level classification, dependent on a parent category.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `category_id` | UUID | No | — | FK → `categories.id` |
| `name` | VARCHAR(100) | No | — | Subcategory name |
| `slug` | VARCHAR(120) | No | — | URL slug |
| `display_order` | INT | No | `0` | Sort order |
| `is_active` | BOOLEAN | No | `true` | Show in filters |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `subcategories_cat_slug_key` | `category_id, slug` | UNIQUE |
| `subcategories_category_id_idx` | `category_id` | INDEX |
| `subcategories_tenant_id_idx` | `tenant_id` | INDEX |

---

## Prisma Models

```prisma
model Category {
  id            String        @id @default(uuid())
  tenantId      String        @map("tenant_id")
  name          String
  slug          String
  icon          String?
  displayOrder  Int           @default(0) @map("display_order")
  isActive      Boolean       @default(true) @map("is_active")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  subcategories Subcategory[]
  products      Product[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("categories")
}

model Subcategory {
  id           String    @id @default(uuid())
  tenantId     String    @map("tenant_id")
  categoryId   String    @map("category_id")
  name         String
  slug         String
  displayOrder Int       @default(0) @map("display_order")
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  category     Category  @relation(fields: [categoryId], references: [id])
  products     Product[]

  @@unique([categoryId, slug])
  @@index([categoryId])
  @@index([tenantId])
  @@map("subcategories")
}
```
