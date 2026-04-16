# Sizing Module (Owner-Defined, Schema-Driven)

## 1) Product Requirements + Technical Design

### 1.1 Objective

Build a sizing system where:

* **Owner** can add any product (dress, shoes, two-piece sets, hair clips, bangles, etc.)
* Owner can **assign sizes properly** (simple or structured)
* **Customer** sees sizes clearly on PDP (product details page), selects a size, and orders.

No “smart sizing”, no fit prediction. Just **correct modeling + correct display + correct selection**.

---

## 1.2 Core Idea (Why this supports unlimited product types)

Instead of hard-coding “dress sizing”, “shoe sizing”, “jewelry sizing”, the system uses:

* **SizeSchema** = a template describing what a “size” looks like for a product type
* **SizeInstance** = an actual size value (e.g., “M”, “US 9 Wide”, “66mm inner diameter”)

So to support a new product type later, you **don’t change code or database tables** — you attach the product type to an appropriate schema and create the needed size instances.

---

## 1.3 User Stories

### Admin / Owner

1. As an owner, I can create a product type like “Sneakers” and assign a size schema like “Shoe (system + size + width)”.
2. As an owner, I can add a product and create variants for the sizes I want to sell (US 8, US 8.5, US 9…).
3. As an owner, I can optionally add a size chart (a “Size Guide” table) to show measurements in the PDP.
4. As an owner, I can reuse existing size instances (e.g., S/M/L) across products to work faster.

### Customer

1. As a customer, I see available sizes clearly and can select one.
2. I can view a size guide if provided (e.g., chest/waist cm or shoe conversions).

---

## 1.4 In Scope (MVP)

✅ Unlimited product sizing scenarios using **schemas + instances**
✅ Variant-level sizing (every SKU/variant has exactly one SizeInstance)
✅ PDP size selector renders from schema UI definition
✅ Optional Size Guide table (size chart)
✅ Multi-part sizes (two-piece sets: top + bottom) supported via a schema

---

## 1.5 Out of Scope (explicitly)

❌ Fit recommendation
❌ Customer measurement profiles
❌ Automated chart tuning / ML / AI
❌ Return-feedback loops

(You can add later, but not required for a “perfect basic sizing system”.)

---

## 1.6 Functional Requirements

### A) Admin: Size Schema Management

* Create a SizeSchema with:

  * list of **dimensions** (fields)
  * basic UI rendering config (how to show selector)
  * normalization key template (to deduplicate sizes)
* Schemas are versioned:

  * `draft` → `active` → optional `deprecated`

**Important:** Most stores will only need ~8–12 schemas (see “Starter Schema Library” below).

---

### B) Admin: Product Setup

* ProductType has `default_size_schema_id`
* Product inherits the schema from ProductType (optionally override per product)
* Owner creates variants and picks/creates a size instance for each variant

---

### C) Admin: Size Chart (Optional “Size Guide”)

* A size chart is a **table** attached to schema (optionally scoped to brand/product).
* Size chart rows store ranges/values for dimensions (e.g., chest 96–100 cm).
* If a chart exists, show “Size Guide” on PDP.

Chart scope precedence when resolving “active chart”:

1. Product-scoped chart
2. Brand-scoped chart
3. Global chart

---

### D) Storefront: PDP Size Selector

The selector is schema-driven:

* `grid`: S/M/L buttons
* `dropdown`: a simple list
* `composite`: system + size + width (shoe)
* `component`: top selector + bottom selector (two-piece set)

Customer must select a size before adding to cart.

---

## 1.7 Starter Schema Library (Recommended)

Start with these schemas; they cover nearly everything:

1. `APPAREL_ALPHA` → XS–XXXL (+ optional fit)
2. `APPAREL_NUMERIC` → 0–30 (+ optional region)
3. `PANTS_WAIST_INSEAM` → waist + inseam (+ optional fit)
4. `SHOE_SYSTEM_SIZE_WIDTH` → system (US/UK/EU) + size + width
5. `BRA_BAND_CUP` → band + cup
6. `JEWELRY_DIAMETER_MM` → inner diameter mm (rings/bangles)
7. `ONE_SIZE_DIMENSIONED` → one-size + optional length/width (hair clips etc.)
8. `BUNDLE_COMPONENT_SIZING` → top size + bottom size (two-piece sets)

You can add more later without code changes.

---

## 1.8 SizeSchema Definition (JSON Contract)

### Dimension Types (minimum set)

* `enum` (e.g., cup: A/B/C/D, system: US/EU/UK)
* `number` (e.g., waist: 32, diameter_mm: 66)
* `text` (rare, but allowed)
* `object` (for component sizing: top/bottom)

### Example: APPAREL_ALPHA

```json
{
  "dimensions": [
    { "code": "label", "type": "enum", "required": true, "values": ["XS","S","M","L","XL","XXL"] },
    { "code": "fit", "type": "enum", "required": false, "values": ["slim","regular","oversized"] }
  ],
  "ui": {
    "selectorType": "grid",
    "displayTemplate": "{label}{fit?(' · '+fit):''}",
    "dimensionOrder": ["label","fit"]
  },
  "normalization": {
    "normalizedKeyTemplate": "alpha|{label}|{fit||'regular'}"
  }
}
```

### Example: SHOE_SYSTEM_SIZE_WIDTH

```json
{
  "dimensions": [
    { "code": "system", "type": "enum", "required": true, "values": ["US","UK","EU"] },
    { "code": "size", "type": "number", "required": true, "step": 0.5, "min": 1, "max": 16 },
    { "code": "width", "type": "enum", "required": false, "values": ["N","M","W","XW"] }
  ],
  "ui": {
    "selectorType": "composite",
    "displayTemplate": "{system} {size}{width?(' / '+width):''}",
    "dimensionOrder": ["system","size","width"]
  },
  "normalization": {
    "normalizedKeyTemplate": "shoe|{system}|{size}|{width||'STD'}"
  }
}
```

### Example: BUNDLE_COMPONENT_SIZING (Two-piece)

```json
{
  "dimensions": [
    { "code": "top", "type": "object", "required": true },
    { "code": "bottom", "type": "object", "required": true }
  ],
  "ui": {
    "selectorType": "component",
    "components": {
      "top": { "schemaCode": "APPAREL_ALPHA" },
      "bottom": { "schemaCode": "PANTS_WAIST_INSEAM" }
    }
  },
  "normalization": {
    "normalizedKeyTemplate": "set|top:{top.key}|bottom:{bottom.key}"
  }
}
```

---

## 1.9 API Surface (Minimal)

### Storefront

* `GET /api/products/:id/sizing`

  * returns active schema + size instances available (per variant) + optional size chart
* `POST /api/cart/add`

  * requires `variant_id` (size already selected via variant)

### Admin

* `POST /api/admin/size-schemas` (create draft)
* `POST /api/admin/size-schemas/:id/activate` (make active version)
* `POST /api/admin/size-instances` (create/reuse)
* `POST /api/admin/size-charts` + `/rows` (optional size guide)

---

## 1.10 Rendering Logic (PDP)

Given `schema.ui.selectorType`:

* `grid`: render buttons from distinct `display_label`
* `dropdown`: render dropdown from `display_label`
* `composite`: render multiple selectors and filter to valid variants
* `component`: render top and bottom selectors and filter valid set variants

**Rule of thumb:** PDP selection ultimately resolves to a **variant_id**.

---

## 1.11 Data Integrity Rules (Simple but important)

* Every Variant must reference exactly one `size_instance_id`
* A SizeInstance must belong to one SizeSchema
* A SizeSchema “active version” must be explicit (status field)
* For size charts:

  * enforce scope correctness (brand/product IDs required depending on scope)
  * resolve chart by precedence (product > brand > global)

---

## 1.12 Redis (Optional)

You can run perfectly without Redis at first. If you use Redis later, cache:

* active schema definition by code/version
* resolved active size chart per product
* PDP sizing payload

---

---

# 2) PostgreSQL DDL (Ready to implement)

> Assumes you use UUIDs and want server-side UUID generation.

```sql
-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1) Size Schemas
-- =========================
CREATE TABLE IF NOT EXISTS size_schemas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,          -- e.g. APPAREL_ALPHA
  version      INT  NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft', -- draft|active|deprecated
  definition   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT size_schemas_status_chk
    CHECK (status IN ('draft','active','deprecated'))
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
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id        UUID NOT NULL REFERENCES product_types(id),
  brand_id               UUID NULL, -- optional, keep as UUID for future brand table
  title                  TEXT NOT NULL,

  -- Optional override: product uses a different schema than its product type
  size_schema_override_id UUID NULL REFERENCES size_schemas(id),

  -- Optional flags/policy, not required for MVP
  sizing_policy          JSONB NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
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

  -- stable key to deduplicate; generated via normalization template in app
  normalized_key TEXT NOT NULL,

  -- what users see on PDP: "M", "US 9 / W", "66mm"
  display_label  TEXT NOT NULL,

  -- structured values (schema-defined)
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL UNIQUE,

  size_instance_id UUID NOT NULL REFERENCES size_instances(id),

  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  inventory       INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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

  -- global|brand|product
  scope          TEXT NOT NULL DEFAULT 'global',

  brand_id       UUID NULL,
  product_id     UUID NULL REFERENCES products(id) ON DELETE CASCADE,

  locale         TEXT NULL,       -- e.g. en-US, bn-BD
  size_system    TEXT NULL,       -- e.g. US/EU/UK

  version        INT NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft|active|deprecated

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE NULL,

  chart_meta     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT size_charts_scope_chk
    CHECK (scope IN ('global','brand','product')),

  CONSTRAINT size_charts_status_chk
    CHECK (status IN ('draft','active','deprecated')),

  -- Scope rules:
  CONSTRAINT size_charts_brand_scope_chk
    CHECK (
      (scope <> 'brand') OR (brand_id IS NOT NULL AND product_id IS NULL)
    ),

  CONSTRAINT size_charts_product_scope_chk
    CHECK (
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_chart_id   UUID NOT NULL REFERENCES size_charts(id) ON DELETE CASCADE,

  -- e.g. "S", "M", "L", "32W/34L", "US 9"
  size_code       TEXT NOT NULL,

  -- e.g. {"chest_cm":{"min":96,"max":100},"waist_cm":{"min":78,"max":82}}
  ranges          JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- optional: garment measures (or extra notes)
  garment_measures JSONB NULL,

  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_size_chart_rows_chart_sort
  ON size_chart_rows (size_chart_id, sort_order);

CREATE INDEX IF NOT EXISTS gin_size_chart_rows_ranges
  ON size_chart_rows USING GIN (ranges);
```

---

## 2.1 “Resolve Active Chart” Query (preference logic)

When loading PDP size guide, resolve the best chart using precedence:

1. product scope
2. brand scope
3. global scope

…and only `status='active'` and effective date.

Example (pseudo-SQL; adapt as needed):

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
