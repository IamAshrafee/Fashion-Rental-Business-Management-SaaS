# P04 — Product Management (Backend)

| | |
|---|---|
| **Phase** | 2 — Core Business Modules |
| **Estimated Time** | 5–6 hours |
| **Requires** | P03 (auth, guards, tenant middleware) |
| **Unlocks** | P07, P13, P17 |

---

## REFERENCE DOCS

**Cross-cutting:** All 12 docs from `_overview.md`

**Feature specs:**
- `docs/features/category-management.md` — Categories + subcategories
- `docs/features/color-variant-system.md` — Variants + colors + images
- `docs/features/product-details-builder.md` — Custom detail headers/items
- `docs/features/rental-pricing.md` — Pricing modes (one_time, per_day, percentage)
- `docs/features/size-system.md` — Size management
- `docs/features/service-protection.md` — Deposits, cleaning fees, backup sizes
- `docs/features/stock-inventory.md` — Inventory management
- `docs/features/target-tracking.md` — ROI target tracking
- `docs/features/try-before-rent.md` — Try-on feature
- `docs/features/search-system.md` — Full-text + fuzzy search
- `docs/features/filter-system.md` — Filter by category, event, color, price, availability
- `docs/features/faq-system.md` — Product FAQs

**Database schemas:**
- `docs/database/product.md`, `product-variant.md`, `product-image.md`, `product-detail.md`
- `docs/database/pricing.md`, `service-options.md`, `size.md`
- `docs/database/category.md`, `event.md`, `color.md`
- `docs/database/faq.md`, `review.md`

**API specs:**
- `docs/api/product.md` — Product CRUD endpoints
- `docs/api/category.md` — Category CRUD endpoints
- `docs/api/search.md` — Search endpoints
- `docs/api/inventory.md` — Inventory endpoints
- `docs/api/upload.md` — Image upload endpoints

**Flows:**
- `docs/flows/owner-add-product-flow.md` — Full add-product workflow

---

## SCOPE

The entire product management backend — categories, colors, products, variants, images, pricing, services, sizes, FAQs, search, and filtering.

### 1. Category Module
- CRUD for categories (tenant-scoped)
- CRUD for subcategories (within category)
- Event CRUD (tenant-scoped, many-to-many with products)
- Color CRUD (global seed + tenant custom colors)
- Reorder categories (sequence field)

### 2. Product Module

**Product CRUD:**
- Create product (name, category, subcategory, description, status)
- Auto-generate slug from name (unique per tenant)
- Update product
- Soft delete → trash (move to `deleted_at`)
- Restore from trash
- Permanent delete (only from trash, only if no active bookings)
- List products (paginated, filterable, sortable)
- Get single product by slug (for storefront) or by ID (for owner)

**Variant management (within product):**
- Add variant (main color, optional name, sequence)
- Edit variant
- Delete variant (cascade images + variant_colors)
- Reorder variants

**Image management (within variant):**
- Upload images via MinIO (WebP conversion, 3 sizes via Sharp)
- Reorder images (sequence field)
- Delete image (remove from MinIO + DB)
- Max images per variant: per subscription plan

**Pricing management (per product):**
- Set pricing mode: one_time, per_day, percentage
- Set base price fields per mode
- Set extended rental rate, late fee config
- Set shipping fee
- Calculate effective price (for percentage mode)

**Service options (per product):**
- Set deposit amount
- Set cleaning fee
- Enable/disable backup size + fee
- Enable/disable try-on + fee + credit config

**Size management (per product):**
- Set size system: standard, custom, or garment
- Set available sizes
- Set standard size chart or custom measurements

**Product details builder:**
- Add custom detail headers (e.g., "Fabric Details", "Care Instructions")
- Add detail items within headers
- Reorder headers and items

**FAQ management:**
- CRUD for product FAQs
- Reorder FAQs

### 3. Search & Filter Module

**Full-text search:**
- Search products by `search_vector` (tsvector)
- Fuzzy fallback via `pg_trgm` if < 3 results
- Auto-update search_vector on product create/update (DB trigger)

**Filter system:**
- Filter by: category, subcategory, event, color (main + identical), price range, availability, status
- Combine multiple filters (AND logic)
- Sort by: newest, price low→high, price high→low, most rented

### 4. Image Upload Service

```typescript
// Upload pipeline:
// 1. Validate file type (JPEG, PNG, WebP, HEIC) + size (max 5MB)
// 2. Convert to WebP via Sharp
// 3. Generate 3 sizes: thumbnail (400px), medium (800px), full (1200px)
// 4. Upload all 3 to MinIO: /tenants/{tenantId}/products/{productId}/{size}_{hash}.webp
// 5. Return URLs for all 3 sizes
```

### 5. Event Emission

Emit events for the event system (cross-module communication):
- `product.created` — when product is published
- `product.updated` — when product details change
- `product.deleted` — when product is soft-deleted

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Category CRUD API | Create, read, update, delete, reorder categories |
| 2 | Subcategory CRUD | Nested under categories |
| 3 | Event CRUD | Create, assign to products |
| 4 | Color CRUD | Seed defaults + tenant custom |
| 5 | Product CRUD API | Full lifecycle: create → publish → archive → trash → restore/delete |
| 6 | Variant management | Add/edit/delete/reorder variants per product |
| 7 | Image upload pipeline | Upload → validate → WebP → 3 sizes → MinIO |
| 8 | Pricing engine | All 3 modes working with calculations |
| 9 | Service options | Deposit, cleaning, backup, try-on config |
| 10 | Size system | Standard + custom sizes |
| 11 | Product details builder | Custom headers/items CRUD |
| 12 | FAQ management | Per-product FAQ CRUD |
| 13 | Search endpoint | Full-text + fuzzy search |
| 14 | Filter endpoint | Multi-filter with sorting |
| 15 | Soft delete + trash | Delete → trash → restore or permanent |

---

## ACCEPTANCE CRITERIA

```bash
# Category management
POST /api/v1/categories → creates category
GET /api/v1/categories → returns tenant's categories with subcategories

# Product lifecycle
POST /api/v1/products → creates draft product
PATCH /api/v1/products/:id → updates product
PATCH /api/v1/products/:id/status → publish/archive product
DELETE /api/v1/products/:id → soft delete (to trash)
POST /api/v1/products/:id/restore → restore from trash

# Variants & Images
POST /api/v1/products/:id/variants → add variant
POST /api/v1/products/:id/variants/:vid/images → upload image
# Image appears in MinIO in 3 sizes

# Search
GET /api/v1/products?search=wedding+saree → full-text results
GET /api/v1/products?category=:id&event=:id&sort=newest → filtered results

# Pricing
POST /api/v1/products/:id/pricing → set pricing
# Calculated price correct for percentage mode
```

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Product CRUD API endpoints | P13 (Owner Product UI), P17 (Guest Storefront) |
| Category/Event endpoints | P13, P17 |
| Search/Filter endpoints | P17 (Guest search) |
| Image upload service | P13 (Owner image upload UI) |
| Product detail by slug endpoint | P17 (Guest product detail page) |
| Product data for booking | P07 (Booking engine — needs product + pricing data) |
