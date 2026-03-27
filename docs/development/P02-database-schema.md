# P02 — Database Schema & Prisma

| | |
|---|---|
| **Phase** | 1 — Foundation |
| **Estimated Time** | 2–3 hours |
| **Requires** | P01 (project scaffolding, Docker running) |
| **Unlocks** | P03 |

---

## REFERENCE DOCS (Read All)

**Cross-cutting (read first):**
- `docs/architecture-decisions.md` — ADR-04 (integer currency), ADR-06 (date_blocks exclusion), ADR-02 (no orders table)
- `docs/coding-standards.md`
- `docs/performance-engineering.md` — §1 all index decisions
- `docs/deletion-strategy.md` — soft delete patterns

**Database schemas (implement all):**
- `docs/database/_overview.md` — ER diagram and table index
- `docs/database/tenant.md` — tenants + store_settings
- `docs/database/user.md` — users + tenant_users
- `docs/database/subscription.md` — subscription_plans + subscriptions
- `docs/database/product.md` — products
- `docs/database/product-variant.md` — product_variants + variant_colors
- `docs/database/product-image.md` — product_images
- `docs/database/product-detail.md` — product_detail_headers + product_detail_items
- `docs/database/pricing.md` — product_pricing
- `docs/database/service-options.md` — product_services
- `docs/database/size.md` — product_sizes
- `docs/database/category.md` — categories + subcategories
- `docs/database/event.md` — events + product_events
- `docs/database/color.md` — colors
- `docs/database/customer.md` — customers + customer_tags
- `docs/database/booking.md` — bookings + date_blocks
- `docs/database/booking-item.md` — booking_items + damage_reports
- `docs/database/payment.md` — payments
- `docs/database/notification.md` — notifications
- `docs/database/audit-log.md` — audit_logs
- `docs/database/faq.md` — product_faqs
- `docs/database/review.md` — reviews
- `docs/database/seed-data.md` — seed data strategy

---

## SCOPE

Implement the **complete** Prisma schema and database setup. Every table, every index, every relation.

### 1. Prisma Schema File

Create `apps/backend/prisma/schema.prisma` with ALL models from the database docs above. Key rules:

- **All money fields are `Int`** — never `Decimal` (ADR-04)
- **All tables use `@@map("table_name")`** — snake_case in DB, camelCase in code
- **All columns use `@map("column_name")`** — same pattern
- **UUIDs for all primary keys** — `@id @default(uuid())`
- **`tenant_id` on every tenant-scoped table** — referenced as FK
- **Soft delete** — `deletedAt DateTime? @map("deleted_at")` on products, bookings, customers
- **Timestamps** — `createdAt` + `updatedAt` on every table

### 2. Raw SQL Migrations

Some features require raw SQL (Prisma can't express them):

```sql
-- Migration: enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Migration: date_blocks exclusion constraint
ALTER TABLE date_blocks ADD CONSTRAINT no_overlapping_blocks
  EXCLUDE USING gist (
    product_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (block_type != 'manual');

-- Migration: products search vector trigger
CREATE OR REPLACE FUNCTION products_search_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_update
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_trigger();

-- Migration: partial indexes
CREATE INDEX products_storefront_idx
  ON products (tenant_id, created_at DESC)
  WHERE status = 'published' AND is_available = true AND deleted_at IS NULL;

CREATE INDEX products_trgm_idx ON products USING gin(name gin_trgm_ops);
```

### 3. Seed Data System

Create `apps/backend/prisma/seed.ts`:
- SaaS Admin user (superadmin)
- Default subscription plans (Free, Pro, Enterprise)
- Default starter template for BD (categories, events, colors)
- Default starter template for generic (international categories)

Reference: `docs/database/seed-data.md`

### 4. Prisma Client Generation

```bash
npx prisma generate    # Generate client
npx prisma migrate dev # Create initial migration
npx prisma db seed     # Run seed
```

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Complete `schema.prisma` with all models | `npx prisma validate` passes |
| 2 | Initial migration created | `npx prisma migrate dev` succeeds |
| 3 | Raw SQL migrations for extensions + triggers | Applied after Prisma migration |
| 4 | Seed script | `npx prisma db seed` creates admin + plans + templates |
| 5 | PrismaService updated | Service imports generated client |
| 6 | All enums defined | Every enum from the database docs |
| 7 | All indexes match the docs | Including partial and GiST indexes |

---

## ACCEPTANCE CRITERIA

```bash
npx prisma validate                    # Schema is valid
npx prisma migrate dev --name init     # Migration creates all tables
npx prisma db seed                     # Seed data inserted
npx prisma studio                      # Can browse all tables in Studio
# All tables visible with correct columns
# Exclusion constraint exists on date_blocks
# Trigger exists on products for search_vector
# All partial indexes exist
```

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Complete Prisma schema with all models | P03–P10 (all backend packages) |
| Generated `@prisma/client` with types | P03–P10 |
| Database with all tables + indexes | P03–P10 |
| Seed data (admin, plans, templates) | P03 |
| Enum types exported | P03–P10 |
