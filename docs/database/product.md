# Database Schema: `products`

## Table: `products`

The central entity. Contains all product metadata. Variants, images, pricing, sizes, and services are in related tables.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `name` | VARCHAR(200) | No | — | Product display name |
| `slug` | VARCHAR(250) | No | — | URL slug (unique per tenant) |
| `description` | TEXT | Yes | `NULL` | Rich text product description |
| `category_id` | UUID | No | — | FK → `categories.id` |
| `subcategory_id` | UUID | Yes | `NULL` | FK → `subcategories.id` |
| `status` | ENUM | No | `'draft'` | draft, published, archived |
| `is_available` | BOOLEAN | No | `true` | Availability toggle |
| `available_from` | DATE | Yes | `NULL` | Future availability date |
| `unavailable_reason` | VARCHAR(300) | Yes | `NULL` | Internal reason for unavailability |
| `purchase_date` | DATE | Yes | `NULL` | When item was purchased |
| `purchase_price` | INTEGER | Yes | `NULL` | Cost to acquire the item (integer) |
| `purchase_price_public` | BOOLEAN | No | `false` | Show purchase price to guests |
| `item_country` | VARCHAR(100) | Yes | `NULL` | Country of origin |
| `item_country_public` | BOOLEAN | No | `false` | Show country to guests |
| `target_rentals` | INT | Yes | `NULL` | Manual target rental count |
| `total_bookings` | INT | No | `0` | Cached booking count |
| `total_revenue` | INTEGER | No | `0` | Cached revenue total |
| `search_vector` | TSVECTOR | Yes | — | Full-text search vector |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |
| `deleted_at` | TIMESTAMP | Yes | `NULL` | Soft delete timestamp |

### Enums

```prisma
enum ProductStatus {
  draft
  published
  archived
}
```

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `products_tenant_slug_key` | `tenant_id, slug` | UNIQUE | URL uniqueness per tenant |
| `products_category_id_idx` | `category_id` | INDEX | Category filtering |
| `products_status_idx` | `tenant_id, status` | INDEX | Status filtering |
| `products_search_idx` | `search_vector` | GIN | Full-text search |
| `products_trgm_idx` | `name` | GIN (gin_trgm_ops) | Fuzzy search |
| `products_storefront_idx` | `tenant_id, created_at DESC` | PARTIAL (WHERE status='published' AND is_available=true AND deleted_at IS NULL) | Storefront listing |
| `products_deleted_at_idx` | `deleted_at` | INDEX (where null) | Exclude soft-deleted |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | belongs-to | `tenants` |
| `category` | belongs-to | `categories` |
| `subcategory` | belongs-to | `subcategories` |
| `variants` | has-many | `product_variants` |
| `events` | many-to-many | `events` (via `product_events`) |
| `productSize` | has-one | `product_sizes` |
| `pricing` | has-one | `product_pricing` |
| `services` | has-one | `product_services` |
| `faqs` | has-many | `product_faqs` |
| `detailHeaders` | has-many | `product_detail_headers` |
| `bookingItems` | has-many | `booking_items` |

---

## Prisma Model

```prisma
model Product {
  id                  String        @id @default(uuid())
  tenantId            String        @map("tenant_id")
  name                String
  slug                String
  description         String?
  categoryId          String        @map("category_id")
  subcategoryId       String?       @map("subcategory_id")
  status              ProductStatus @default(draft)
  isAvailable         Boolean       @default(true) @map("is_available")
  availableFrom       DateTime?     @map("available_from") @db.Date
  unavailableReason   String?       @map("unavailable_reason")
  purchaseDate        DateTime?     @map("purchase_date") @db.Date
  purchasePrice       Int?          @map("purchase_price")
  purchasePricePublic Boolean       @default(false) @map("purchase_price_public")
  itemCountry         String?       @map("item_country")
  itemCountryPublic   Boolean       @default(false) @map("item_country_public")
  targetRentals       Int?          @map("target_rentals")
  totalBookings       Int           @default(0) @map("total_bookings")
  totalRevenue        Int           @default(0) @map("total_revenue")
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")
  deletedAt           DateTime?     @map("deleted_at")

  tenant              Tenant        @relation(fields: [tenantId], references: [id])
  category            Category      @relation(fields: [categoryId], references: [id])
  subcategory         Subcategory?  @relation(fields: [subcategoryId], references: [id])
  variants            ProductVariant[]
  events              ProductEvent[]
  productSize         ProductSize?
  pricing             ProductPricing?
  services            ProductServices?
  faqs                ProductFaq[]
  detailHeaders       ProductDetailHeader[]
  bookingItems        BookingItem[]

  @@unique([tenantId, slug])
  @@index([categoryId])
  @@index([tenantId, status])
  @@map("products")
}
```

---

## Notes

- `search_vector` is maintained via a PostgreSQL trigger (not Prisma — raw SQL migration)
- `total_bookings` and `total_revenue` are denormalized cached values updated on order completion
- `deleted_at` enables soft delete — all queries filter `WHERE deleted_at IS NULL`
- `slug` auto-generated from `name` on creation, unique per tenant
