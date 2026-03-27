# Performance Engineering — ClosetRent SaaS

Pre-development audit of database, API, caching, and infrastructure efficiency. Issues are ranked by severity: 🔴 Critical (fix before coding), 🟡 Important (fix during development), 🟢 Optimization (can be deferred).

---

## 1. Database Schema Issues

### 🔴 1.1 — All Money Fields Must Be INTEGER (Not DECIMAL)

**ADR-04** states: *"All currency stored as integers (৳7,500 → stored as `7500`). Always round UP."*

But **every schema** still uses `DECIMAL(12,2)`:

| Table | Affected Columns |
|---|---|
| `bookings` | subtotal, total_fees, shipping_fee, total_deposit, grand_total, total_paid |
| `booking_items` | base_rental, extended_cost, deposit_amount, deposit_refund_amount, cleaning_fee, backup_size_fee, try_on_fee, item_total, late_fee |
| `products` | purchase_price, total_revenue |
| `customers` | total_spent |
| `product_pricing` | All price columns |
| `product_services` | All fee columns |
| `damage_reports` | estimated_repair_cost, deduction_amount, additional_charge |
| `payments` | amount |

**Fix**: Change all money columns from `DECIMAL(12,2)` → `INTEGER`. This also:
- Eliminates floating-point rounding bugs
- Reduces storage size (4 bytes vs 8+ bytes per field)
- Faster comparisons and aggregations
- Simpler math in application code

---

### 🔴 1.2 — `date_blocks` Needs Exclusion Constraint for Concurrency

**ADR-06** states: *"Concurrency handled by database-level UNIQUE constraints on date blocks."*

Current index is just a B-tree: `@@index([productId, startDate, endDate])` — this does **NOT** prevent overlapping ranges. Two concurrent requests can both insert overlapping dates.

**Fix**: Use PostgreSQL `EXCLUDE` constraint with `tsrange`:

```sql
-- Must add btree_gist extension first
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE date_blocks ADD CONSTRAINT no_overlapping_blocks
  EXCLUDE USING gist (
    product_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (block_type != 'manual');
```

This guarantees at the database level that no two bookings can overlap dates for the same product. The `WHERE` clause allows manual blocks to overlap with bookings (owner override).

---

### 🔴 1.3 — `store_settings` Missing Locale Configuration Fields

Per the localization-strategy.md, these fields must exist:

```
timezone           VARCHAR(50)    NOT NULL  DEFAULT 'UTC'     -- IANA timezone
country            VARCHAR(2)     NOT NULL  DEFAULT 'BD'      -- ISO 3166-1
currency_code      VARCHAR(3)     NOT NULL  DEFAULT 'BDT'     -- ISO 4217
currency_symbol    VARCHAR(5)     NOT NULL  DEFAULT '৳'
currency_position  VARCHAR(10)    NOT NULL  DEFAULT 'before'  -- before/after
number_format      VARCHAR(20)    NOT NULL  DEFAULT 'south_asian' -- south_asian/international
date_format        VARCHAR(20)    NOT NULL  DEFAULT 'DD/MM/YYYY'
time_format        VARCHAR(5)     NOT NULL  DEFAULT '12h'     -- 12h/24h
week_start         VARCHAR(10)    NOT NULL  DEFAULT 'saturday'
```

Without these, localization cannot work per-tenant.

---

### 🔴 1.4 — Delivery Address Fields Are BD-Specific

`bookings` table has hardcoded BD address fields:
- `delivery_area` — BD-specific concept
- `delivery_thana` — BD-specific concept
- `delivery_district` — BD-specific concept

**Fix**: Replace with flexible address JSONB:

```sql
delivery_address_line1  VARCHAR(500)  NOT NULL
delivery_address_line2  VARCHAR(500)  NULL
delivery_city           VARCHAR(100)  NOT NULL
delivery_state          VARCHAR(100)  NULL
delivery_postal_code    VARCHAR(20)   NULL
delivery_country        VARCHAR(2)    NOT NULL  -- ISO 3166-1
delivery_extra          JSONB         NULL      -- tenant-specific fields (thana, district, etc.)
```

Same applies to `customers` table (`area`, `thana`, `district` columns).

---

### 🟡 1.5 — Redundant Single-Column `tenant_id` Indexes

Most tables have `@@index([tenantId])` **and** composite indexes that start with `tenantId`:

```
products: @@index([tenantId]) + @@index([tenantId, status]) + @@index([tenantId, slug])
bookings: @@index([tenantId]) + @@index([tenantId, status]) + @@index([tenantId, createdAt])
```

PostgreSQL composite indexes can serve queries on their leading columns. The standalone `@@index([tenantId])` is **redundant** when composite indexes already start with `tenantId`.

**Fix**: Remove standalone `@@index([tenantId])` from tables that already have composite indexes starting with `tenantId`. This saves disk space and write overhead.

**Exception**: Keep it on tables where it's the ONLY index containing `tenantId`.

---

### 🟡 1.6 — Missing Composite Index for Product Listing (Hot Path)

The most frequent query is: **"List published, available products for this tenant, sorted by newest"**

```sql
WHERE tenant_id = ? AND status = 'published' AND is_available = true AND deleted_at IS NULL
ORDER BY created_at DESC
```

No single index covers this. Current indexes:
- `@@index([tenantId, status])` — covers tenant + status but not availability or soft-delete

**Fix**: Add a covering partial index:

```sql
CREATE INDEX products_storefront_idx
  ON products (tenant_id, created_at DESC)
  WHERE status = 'published' AND is_available = true AND deleted_at IS NULL;
```

This partial index is:
- **Small** (only published + available products, ~20-50% of rows)
- **Pre-sorted** (DESC for latest first)
- **Instant** for the most frequent query

---

### 🟡 1.7 — Missing Index for Availability Check (Critical Path)

Availability checking is the second most frequent query:

```sql
SELECT * FROM date_blocks
WHERE product_id = ? AND start_date <= ? AND end_date >= ?
```

Current index `@@index([productId, startDate, endDate])` is a B-tree which doesn't efficiently handle range overlap queries.

**Fix**: Already handled by the GiST exclusion constraint in §1.2, but add a dedicated GiST index:

```sql
CREATE INDEX date_blocks_overlap_gist
  ON date_blocks USING gist (
    product_id,
    daterange(start_date, end_date, '[]')
  );
```

---

### 🟡 1.8 — UUID Primary Key Performance Considerations

UUIDs are 16 bytes vs 4 bytes for INT. For this SaaS scale (< 100 tenants, < 100K products total), UUID overhead is acceptable. However:

**Optimization**: Use `uuid_generate_v7()` (time-ordered UUIDs) instead of `gen_random_uuid()` (v4):
- V7 UUIDs are **chronologically sorted** → better B-tree index locality
- Reduces page splits during inserts
- Available in PostgreSQL 17+ or via `pgcrypto` extension

If PG < 17, use ULID generation in application code and store as UUID.

---

### 🟢 1.9 — Table Statistics and Auto-Analyze

Ensure PostgreSQL `autovacuum` and `autoanalyze` are properly configured:

```sql
-- For high-write tables (bookings, date_blocks, audit_logs)
ALTER TABLE bookings SET (autovacuum_analyze_threshold = 50);
ALTER TABLE date_blocks SET (autovacuum_analyze_threshold = 50);
ALTER TABLE audit_logs SET (autovacuum_analyze_threshold = 100);
```

---

## 2. Query Performance

### 🔴 2.1 — N+1 Query Prevention (Prisma)

Prisma's lazy loading causes N+1 by default. The top 5 N+1 traps:

| Query | N+1 Trap | Fix |
|---|---|---|
| Product list → variants → images | 3 levels of lazy loading | Use `include: { variants: { include: { images: true, mainColor: true } } }` |
| Booking list → items → product | 3 levels | Use `include: { items: { include: { product: true } } }` |
| Dashboard stats → multiple counts | Multiple COUNT queries | Single raw query with multiple aggregations |
| Category list → product count | 1 query per category | `groupBy` or raw COUNT with JOIN |
| Customer list → booking count | Already denormalized | ✅ OK (uses `total_bookings` cache column) |

**Rule**: Every service method must declare its `include` strategy. Never rely on implicit loading.

---

### 🟡 2.2 — Pagination Strategy: Cursor vs Offset

Current spec uses **offset pagination**: `?page=1&limit=20`

**Problem**: Offset pagination degrades as page number grows. `OFFSET 10000` scans 10,000 rows.

**Fix**: Use **cursor-based pagination** for large datasets:

```typescript
// Offset (keep for simple cases < 1000 items)
GET /api/v1/products?page=1&limit=20

// Cursor (use for bookings, audit logs, large product catalogs)
GET /api/v1/bookings?cursor=<last-id>&limit=20&direction=next
```

**Implementation**: Support **both**. Default to offset for <1000 expected results, cursor for unbounded lists.

---

### 🟡 2.3 — Soft Delete Filter Performance

Every query has `WHERE deleted_at IS NULL`. This is a filter on every read.

**Fix**: Already have a partial index on `products`. Add partial indexes on ALL soft-deletable tables:

```sql
CREATE INDEX bookings_active_idx ON bookings (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX customers_active_idx ON customers (tenant_id) WHERE deleted_at IS NULL;
```

---

### 🟢 2.4 — Search Optimization (pg_trgm vs tsvector)

Current: `search_vector TSVECTOR` with GIN index on products.

**Better**: Use **both** `pg_trgm` and `tsvector`:

```sql
-- Full-text search (word matching)
CREATE INDEX products_fts_idx ON products USING gin(search_vector);

-- Fuzzy search (typo tolerance)
CREATE INDEX products_trgm_idx ON products USING gin(name gin_trgm_ops);
```

Query strategy:
1. First try `tsvector` match (fast, exact word match)
2. If < 3 results, fall back to `pg_trgm` (fuzzy)

---

## 3. Caching Strategy Refinement

### 🔴 3.1 — Tenant Info Cache (Every Request)

Tenant resolution happens on **every single request**. The database must NOT be hit every time.

```
Cache Key:    tenant:{subdomain} OR tenant:domain:{customDomain}
TTL:          1 hour
Invalidation: On tenant update (settings, domain, status change)
Content:      id, subdomain, customDomain, status, logo, primaryColor, timezone, currency
```

**Estimated savings**: Eliminates 100% of tenant lookup queries after first load.

---

### 🟡 3.2 — Product List Cache (Most Frequent Read)

```
Cache Key:    products:{tenantId}:list:{page}:{sort}:{filters-hash}
TTL:          5 minutes
Invalidation: On any product create/update/delete for this tenant
Content:      Serialized product list with variant images
```

**Warning**: Don't cache filtered results aggressively — the combination space explodes. Only cache:
- Default listing (no filters, page 1)
- Category pages (category filter only)

---

### 🟡 3.3 — Availability Cache (Critical for UX)

```
Cache Key:    availability:{productId}:{YYYY-MM}
TTL:          30 seconds (very short — accuracy matters)
Invalidation: On any date_block change for this product
Content:      Array of blocked date ranges for the month
```

**Why 30 seconds**: Availability is time-sensitive. Stale data = double bookings. The exclusion constraint (§1.2) is the real guard, but cache avoids unnecessary queries.

---

### 🟢 3.4 — Category/Event List Cache

```
Cache Key:    categories:{tenantId}
TTL:          24 hours
Invalidation: On category create/update/delete
Content:      Full category tree with subcategories
```

These rarely change. Aggressive caching is safe.

---

## 4. API & Network Performance

### 🟡 4.1 — Response Size Optimization

| Optimization | Where |
|---|---|
| **Select only needed fields** | Prisma `select` instead of full model — especially on list endpoints |
| **Exclude internal fields** | Never return `tenant_id`, `deleted_at`, `search_vector` to clients |
| **Image URL optimization** | Return thumbnail URL for lists, full URL for detail page |
| **Gzip/Brotli compression** | Enable in Nginx for all JSON and text responses |
| **Avoid nested includes on lists** | Product list: return variant count, not full variants |

### 🟡 4.2 — API Response Shaping (List vs Detail)

```typescript
// ❌ Bad: Same heavy response for list and detail
GET /products → returns full product with all variants, images, pricing, sizes, FAQs

// ✅ Good: Light response for list, heavy for detail
GET /products → { id, name, slug, featuredImage, categoryName, basePrice, isAvailable }
GET /products/:slug → { ...full product with all relations }
```

---

## 5. Frontend Performance

### 🔴 5.1 — Image Optimization Pipeline

| Stage | Action |
|---|---|
| Upload | Validate type (JPEG, PNG, WebP, HEIC), max 5 MB |
| Process | Convert to WebP, generate 3 sizes (thumbnail 400px, medium 800px, full 1200px) |
| Store | MinIO with structured paths: `/tenants/{id}/products/{id}/{size}_{hash}.webp` |
| Serve | Cloudflare CDN → Nginx cache headers (1 year for hashed filenames) |
| Display | Next.js `<Image>` component with `loading="lazy"`, `sizes` attribute, blur placeholder |

**Estimated savings**: 60-80% bandwidth reduction vs raw uploaded images.

---

### 🟡 5.2 — Core Web Vitals Targets

| Metric | Target | Strategy |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | SSR for product pages, preload hero image |
| FID (First Input Delay) | < 100ms | Minimal client-side JS, code splitting per route |
| CLS (Cumulative Layout Shift) | < 0.1 | Fixed image dimensions, skeleton loading states |
| TTFB (Time to First Byte) | < 600ms | Redis cache for tenant info, SSR with streaming |

---

### 🟡 5.3 — Bundle Size Strategy

| Strategy | Implementation |
|---|---|
| Route-based splitting | Next.js does this automatically via App Router |
| Dynamic imports | Calendar picker, rich text editor, chart libraries — `dynamic(() => import(...))` |
| Tree-shaking | Import only needed ShadCN components, not entire library |
| Font optimization | `next/font` with subset for used characters only |
| No heavy libraries | Avoid moment.js (use `date-fns`), avoid lodash full (use individual imports) |

---

## 6. Infrastructure Performance

### 🟡 6.1 — PostgreSQL Connection Pooling

Prisma uses a connection pool by default, but the config matters:

```env
DATABASE_URL="postgresql://user:pass@postgres:5432/closetrent?connection_limit=20&pool_timeout=10"
```

| Setting | Value | Rationale |
|---|---|---|
| `connection_limit` | 20 | Appropriate for 4-core VPS |
| `pool_timeout` | 10 | Fail fast on pool exhaustion |

**Future**: Add PgBouncer as external pool for connection multiplexing when scaling beyond 1 backend instance.

---

### 🟡 6.2 — Redis Memory Configuration

```conf
maxmemory 200mb
maxmemory-policy allkeys-lru
```

Estimated usage:
- Tenant cache: ~10 KB × 100 tenants = 1 MB
- Product list cache: ~50 KB × 100 tenants × 5 pages = 25 MB
- Session data: ~1 KB × 500 sessions = 0.5 MB
- BullMQ jobs: ~10 MB
- **Total**: ~40 MB (comfortable within 200 MB limit)

---

### 🟡 6.3 — Nginx Tuning

```nginx
# Connection limits
worker_connections 1024;
keepalive_timeout 65;

# Compression
gzip on;
gzip_types application/json text/css application/javascript;
gzip_min_length 1000;

# Static asset caching
location ~* \.(webp|jpg|png|css|js|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=guest:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=120r/m;
```

---

## 7. Summary of Required Schema Changes

These changes MUST be applied to the database schema docs before development:

| # | Change | Files Affected |
|---|---|---|
| 1 | `DECIMAL(12,2)` → `INTEGER` for all money fields | booking.md, booking-item.md, product.md, customer.md, pricing.md, service-options.md, damage-reports section, payment.md |
| 2 | Add `EXCLUDE` constraint on `date_blocks` | booking.md |
| 3 | Add locale fields to `store_settings` | tenant.md |
| 4 | Replace BD-specific address fields with flexible structure | booking.md, customer.md |
| 5 | Remove redundant standalone `tenant_id` indexes | All tenant-scoped tables with composite indexes |
| 6 | Add partial indexes for hot queries | product.md, booking.md |
| 7 | Add `pg_trgm` index for fuzzy search | product.md |

---

## 8. Pre-Development Checklist

Before writing the first line of code:

- [ ] Apply all 🔴 Critical changes to database schema docs
- [ ] Ensure `store_settings` has all locale fields
- [ ] Confirm address structure is flexible (not BD-specific)
- [ ] Validate integer currency throughout all schemas
- [ ] Add exclusion constraint to date_blocks spec
- [ ] Review and finalize caching TTL values
- [ ] Set Core Web Vitals targets in team docs
