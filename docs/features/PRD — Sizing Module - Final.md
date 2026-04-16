# PRD — Sizing Module (Owner-Defined, Schema-Driven, Low-Confusion UX)

**Stack:** Next.js (storefront + admin), Node.js (API/services), PostgreSQL (system of record), Redis (optional cache)

---

## 1) Executive Summary

This PRD defines a **proven, scalable sizing system** for a fashion e-commerce platform where:

* The **Owner** can add **any product type** (dress, shoes, two-piece sets, hair clips, bangles, etc.).
* The Owner can assign **clear, correct sizes** (simple or structured).
* The **Customer** sees a **consistent, low-confusion** sizing experience on PDP (Product Detail Page), selects an appropriate size, and orders.

**Core design choice:** sizing is modeled as **data templates (SizeSchemas)** + **size values (SizeInstances)**, not category hard-coding. This enables “unlimited product types” without database migrations or code branching.

---

## 2) Goals

### 2.1 Product Goals

* Support **unlimited product types** and sizing scenarios via schema-driven configuration.
* Enable Owner to:

  * define/choose a sizing schema for a product type (or override per product),
  * create variants tied to structured sizes,
  * optionally attach a “Size Guide” chart (measurements/conversions) to PDP.
* Enable Customers to:

  * clearly see available sizes,
  * select a size easily,
  * view a size guide adjacent to selector when provided.

### 2.2 UX Goals (Non-Negotiable)

* **Size selection must be highly visible** and consistent across the site.
* Avoid confusing interactions (e.g., options appearing/disappearing unpredictably).
* Always provide a clear path to “Size Guide” where available.

---

## 3) Non-Goals (Explicitly Out of Scope for v1.0)

* Fit recommendation / “Find my size”
* Customer measurement profiles
* ML/AI or automated size optimization
* Return/feedback-driven sizing adjustments
* Automated chart generation or auditing (manual admin is sufficient)

---

## 4) Key Concepts & Definitions

* **ProductType:** A template category used by the owner (e.g., “Women Dress”, “Sneakers”, “Bangle”).
* **SizeSchema:** A sizing template that defines:

  * which dimensions exist (e.g., `label`, `waist`, `inseam`, `system`, `width`, `diameter_mm`),
  * how to render the selector on PDP,
  * how to normalize size values (to create stable unique keys).
* **SizeInstance:** A concrete size value conforming to a schema (e.g., `M`, `32/34`, `US 9 / W`, `66mm`).
* **Variant (SKU):** Purchasable unit. Each variant references exactly one SizeInstance.
* **SizeChart (Size Guide):** Optional tables attached to schema/product/brand/global scope to show measurements & conversions.

---

## 5) Personas & User Stories

### 5.1 Personas

* **Owner/Admin:** Creates products, assigns schemas, defines variants, optionally adds size guides.
* **Customer:** Views PDP, selects size, checks size guide, purchases.

### 5.2 User Stories — Owner/Admin

1. Create a product type “Sneakers” and choose a size schema “SHOE_SYSTEM_SIZE_WIDTH”.
2. Create a product “Nike Air …” and add variants for sizes: US 8, 8.5, 9 Wide.
3. Reuse common sizes (S/M/L) across multiple products without re-entering.
4. Attach a size chart (Size Guide) to a product or brand that appears on PDP.

### 5.3 User Stories — Customer

1. See all sizes clearly and select one before adding to cart.
2. See out-of-stock sizes (clearly marked) rather than being confused by missing options.
3. Open “Size Guide” next to the size selector (if available) to check measurements/conversions.

---

## 6) Functional Requirements

### 6.1 Admin: Sizing Configuration

**FR-A1:** Admin can create/manage SizeSchemas (draft/active/deprecated; versioned).
**FR-A2:** Admin can define schema dimensions (type, required/optional, enums, steps, units).
**FR-A3:** Admin can define schema UI behavior (`selectorType`, display template, ordering).
**FR-A4:** Admin can create SizeInstances for a schema (with `display_label` + `normalized_key`).
**FR-A5:** Admin can set a ProductType default schema; product can optionally override schema.

### 6.2 Admin: Product & Variants

**FR-P1:** Each product is linked to a ProductType.
**FR-P2:** Each product resolves an “active schema” = product override if present else ProductType default.
**FR-P3:** Each variant must reference exactly one SizeInstance of that active schema.
**FR-P4:** Admin cannot save a variant with a SizeInstance from a different schema.

### 6.3 Size Guide (Optional)

**FR-G1:** Admin can create SizeCharts with scope: `global`, `brand`, `product`.
**FR-G2:** SizeCharts are versioned and can be `draft/active/deprecated` with effective dates.
**FR-G3:** On PDP, the active SizeChart resolves by precedence:

1. product scope, 2) brand scope, 3) global scope (latest active version).
   **FR-G4:** SizeChart rows store measurement ranges/values for display (schema-aware).

### 6.4 Storefront: PDP Size Selection

**FR-S1:** PDP renders size selector based on schema `ui.selectorType`.
**FR-S2:** Customer must select a size (variant) before add-to-cart.
**FR-S3:** Out-of-stock/invalid selections must remain visible and be clearly labeled/disabled (no mystery).
**FR-S4:** “Size Guide” link appears adjacent to size selector when a chart exists.

---

## 7) Sizing UX Standard v1.0 (Governing Rules)

### 7.1 Standard Selector Patterns

**UX-1 Buttons as default:**

* If the number of size options is reasonably scannable (typical apparel), show **buttons/chips**.

**UX-2 Avoid unpredictable cascading:**

* Do not make options “appear/disappear” in a way that feels inconsistent.
* If an option is unavailable, keep it visible but **disabled + explained** (e.g., “Out of stock”).

**UX-3 Size Guide proximity:**

* If a size guide exists, show “Size Guide” link **next to** the size selector.

**UX-4 One primary size selector whenever possible:**

* Even if sizes are structured (W/L, US size + width), prefer a single selector using combined labels:

  * `32 / 34`, `US 9 / W`, `34C`, `66mm`

**UX-5 Multi-selector only for truly independent choices:**

* Two selectors allowed when it matches user expectations clearly:

  * Two-piece sets: **Top Size** + **Bottom Size**
  * Shoes: optional **System toggle (US/EU/UK)** + sizes list

### 7.2 Decision Tree (Implementation Rule)

* ≤ ~12 options: **buttons**
* 13–30: **scrollable exposed list**
* > 30: **dropdown with search** (rare for fashion sizing)

### 7.3 Size Guide Content (When Present)

* Show measurement tables relevant to schema (e.g., chest/waist, foot size conversion, jewelry diameter).
* Show both cm/inches when applicable and conversions when relevant.

---

## 8) Technical Design

### 8.1 Architecture Overview

* **Postgres** stores schemas, size instances, products, variants, size charts.
* **Next.js**:

  * Admin UI for managing schemas/instances/charts/products
  * Storefront PDP renders from resolved schema + variant size instances
* **Node.js API** (can be Next.js Route Handlers or separate service):

  * resolves active schema
  * fetches variant-size mapping
  * resolves active size chart (optional)
* **Redis** optional for caching schema/charts per product.

### 8.2 “Resolved Sizing” Flow (PDP)

1. Load product and variants
2. Resolve `active_schema_id` (product override else product type default)
3. Fetch all variants with `size_instance.display_label`
4. If SizeChart exists, resolve by scope precedence and attach to PDP payload
5. Render selector per schema UI rules
6. User selection resolves to a `variant_id`

### 8.3 Admin Variant Creation Flow

1. Owner selects ProductType (schema automatically selected)
2. Owner creates or selects SizeInstances for that schema
3. Owner creates variants linking each to one SizeInstance
4. System validates schema match and saves

---

## 9) Data Model (Entities)

* `size_schemas` (versioned templates)
* `size_instances` (concrete sizes tied to a schema; deduplicated by normalized key)
* `product_types` (default schema mapping)
* `products` (schema override optional)
* `variants` (SKU; references size_instance_id)
* `size_charts` + `size_chart_rows` (optional size guide tables)

---

## 10) API Contracts (Minimal)

### 10.1 Storefront

**GET `/api/products/:id/sizing`**
Returns:

* product id
* resolved schema definition
* list of variants:

  * variant_id, sku, stock, price
  * size_instance: display_label, payload
* active size chart (optional)

**POST `/api/cart/add`**
Body:

* `variant_id`
* `quantity`

### 10.2 Admin

* `POST /api/admin/size-schemas` (create draft)
* `POST /api/admin/size-schemas/:id/activate` (publish/activate new version)
* `POST /api/admin/size-instances` (create/reuse)
* `POST /api/admin/size-charts` (create draft)
* `POST /api/admin/size-charts/:id/activate` (publish)
* `POST /api/admin/products/:id/schema-override` (optional)

---

## 11) Admin Screens (Minimum Viable)

1. **Product Types**

   * name
   * default size schema
2. **Products**

   * product type
   * schema override (optional)
3. **Variants**

   * create/edit variants
   * assign size instance
4. **Size Schemas**

   * list / create / activate
5. **Size Instances**

   * list / create / reuse (with display label preview)
6. **Size Guide**

   * create chart + rows
   * activate chart version

---

## 12) Validation & Error States

* Variant save fails if `size_instance.size_schema_id != resolved_product_schema_id`
* Add-to-cart fails if no variant selected (show “Select a size”)
* Show disabled sizes for out-of-stock variants (label “Out of stock”)

---

## 13) Edge Cases (Supported)

* One-size items (auto-select “One size”, optionally show dimensions)
* Pants W/L combined labels
* Shoes with system + width (system toggle or embedded label)
* Jewelry diameter/circumference
* Two-piece set (Top + Bottom selectors)

---

## 14) Acceptance Criteria (QA Checklist)

**PDP**

* Size selector is visible and consistent
* Size guide link appears next to selector when chart exists
* Add to cart requires a size selection
* Out-of-stock sizes are visible and clearly marked/disabled
* Two-piece set shows Top/Bottom selectors

**Admin**

* Cannot create a variant without a size instance
* Cannot assign size instance from wrong schema
* Size chart precedence works: product > brand > global

---

## 15) Rollout Plan (Safe, Simple)

1. Deploy schema + instance + variant linkage (no size charts yet)
2. Enable size guide for a subset of product types
3. Add remaining schemas and backfill size instances as needed

---

# Appendix A — PostgreSQL DDL (Ready to Implement)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1) Size Schemas
-- =========================
CREATE TABLE IF NOT EXISTS size_schemas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,
  version      INT  NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft', -- draft|active|deprecated
  definition   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT size_schemas_status_chk CHECK (status IN ('draft','active','deprecated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_size_schemas_code_version
  ON size_schemas (code, version);

CREATE INDEX IF NOT EXISTS ix_size_schemas_code_status
  ON size_schemas (code, status);

CREATE INDEX IF NOT EXISTS gin_size_schemas_definition
  ON size_schemas USING GIN (definition);

-- =========================
-- 2) Product Types
-- =========================
CREATE TABLE IF NOT EXISTS product_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  default_size_schema_id UUID NULL REFERENCES size_schemas(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_product_types_default_schema
  ON product_types (default_size_schema_id);

-- =========================
-- 3) Products
-- =========================
CREATE TABLE IF NOT EXISTS products (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id         UUID NOT NULL REFERENCES product_types(id),
  brand_id                UUID NULL,
  title                   TEXT NOT NULL,
  size_schema_override_id UUID NULL REFERENCES size_schemas(id),
  sizing_policy           JSONB NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_products_product_type
  ON products (product_type_id);

CREATE INDEX IF NOT EXISTS ix_products_brand
  ON products (brand_id);

CREATE INDEX IF NOT EXISTS ix_products_schema_override
  ON products (size_schema_override_id);

CREATE INDEX IF NOT EXISTS gin_products_sizing_policy
  ON products USING GIN (sizing_policy);

-- =========================
-- 4) Size Instances
-- =========================
CREATE TABLE IF NOT EXISTS size_instances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_schema_id UUID NOT NULL REFERENCES size_schemas(id),
  normalized_key TEXT NOT NULL,
  display_label  TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_size_instances_schema_key
  ON size_instances (size_schema_id, normalized_key);

CREATE INDEX IF NOT EXISTS ix_size_instances_schema
  ON size_instances (size_schema_id);

CREATE INDEX IF NOT EXISTS gin_size_instances_payload
  ON size_instances USING GIN (payload);

-- =========================
-- 5) Variants (SKUs)
-- =========================
CREATE TABLE IF NOT EXISTS variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku              TEXT NOT NULL UNIQUE,
  size_instance_id UUID NOT NULL REFERENCES size_instances(id),
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  inventory        INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_variants_product
  ON variants (product_id);

CREATE INDEX IF NOT EXISTS ix_variants_size_instance
  ON variants (size_instance_id);

-- =========================
-- 6) Size Charts (Optional Size Guide)
-- =========================
CREATE TABLE IF NOT EXISTS size_charts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_schema_id UUID NOT NULL REFERENCES size_schemas(id),
  scope          TEXT NOT NULL DEFAULT 'global', -- global|brand|product
  brand_id       UUID NULL,
  product_id     UUID NULL REFERENCES products(id) ON DELETE CASCADE,
  locale         TEXT NULL,
  size_system    TEXT NULL,
  version        INT NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft|active|deprecated
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE NULL,
  chart_meta     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT size_charts_scope_chk CHECK (scope IN ('global','brand','product')),
  CONSTRAINT size_charts_status_chk CHECK (status IN ('draft','active','deprecated')),
  CONSTRAINT size_charts_brand_scope_chk CHECK (
    (scope <> 'brand') OR (brand_id IS NOT NULL AND product_id IS NULL)
  ),
  CONSTRAINT size_charts_product_scope_chk CHECK (
    (scope <> 'product') OR (product_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_size_charts_schema_scope
  ON size_charts (size_schema_id, scope);

CREATE INDEX IF NOT EXISTS ix_size_charts_brand
  ON size_charts (brand_id, size_schema_id);

CREATE INDEX IF NOT EXISTS ix_size_charts_product
  ON size_charts (product_id, size_schema_id);

CREATE INDEX IF NOT EXISTS ix_size_charts_active_lookup
  ON size_charts (status, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS gin_size_charts_meta
  ON size_charts USING GIN (chart_meta);

-- =========================
-- 7) Size Chart Rows
-- =========================
CREATE TABLE IF NOT EXISTS size_chart_rows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_chart_id    UUID NOT NULL REFERENCES size_charts(id) ON DELETE CASCADE,
  size_code        TEXT NOT NULL,
  ranges           JSONB NOT NULL DEFAULT '{}'::jsonb,
  garment_measures JSONB NULL,
  sort_order       INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_size_chart_rows_chart_sort
  ON size_chart_rows (size_chart_id, sort_order);

CREATE INDEX IF NOT EXISTS gin_size_chart_rows_ranges
  ON size_chart_rows USING GIN (ranges);
```

---

# Appendix B — Active Size Chart Resolution (SQL Pattern)

```sql
SELECT *
FROM size_charts
WHERE size_schema_id = $1
  AND status = 'active'
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  AND effective_from <= CURRENT_DATE
  AND (
    (scope = 'product' AND product_id = $2)
    OR (scope = 'brand' AND brand_id = $3)
    OR (scope = 'global')
  )
ORDER BY
  CASE scope
    WHEN 'product' THEN 1
    WHEN 'brand' THEN 2
    WHEN 'global' THEN 3
  END,
  version DESC
LIMIT 1;
```