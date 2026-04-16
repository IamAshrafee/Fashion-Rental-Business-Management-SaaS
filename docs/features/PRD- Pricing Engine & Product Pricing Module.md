# PRD / Tech Spec — Pricing Engine & Product Pricing Module (Fashion Rental SaaS)

## 1. Objective

Implement a configurable, versioned pricing system that supports diverse fashion rental pricing models, produces transparent customer quotes, and scales across tenants.

## 2. Goals

* Support multiple base rental models (per-day, flat package, tiered, weekly/monthly, % of retail).
* Support additional charges (cleaning, try-on, insurance), deposits, and late fee policy.
* Provide clear customer-facing quote breakdown and admin preview simulator.
* Guarantee quote/order stability via immutable **PricePolicyVersion** snapshots.
* Deliver deterministic pricing outputs (idempotent for same inputs).

## 3. Non-Goals (Phase 1)

* Tax/VAT engine (leave hooks: `tax_category`, `tax_inclusive` flags)
* Complex shipping rate shopping (can be an add-on component later)
* Damage assessment workflows (post-return charges can be separate module, but compatible)

---

## 4. Key Concepts & Definitions

**Tenant**: business owner (SaaS customer).
**PricingProfile**: pricing configuration container assigned to product (or category template).
**PricePolicyVersion**: immutable snapshot of pricing rules/components used for quoting + ordering.
**RatePlan**: defines base rental calculation.
**PriceComponent**: produces a line item (fee, discount, deposit, add-on).
**Condition**: rule controlling applicability of plans/components.
**Quote**: computed pricing output for a product + rental period + context.
**Line Item**: itemized monetary record that sums into totals.

---

## 5. User Stories

### Admin (Merchant)

1. As an admin, I can choose a pricing template (per-day/package/tiered/weekly/% retail).
2. As an admin, I can add optional components (cleaning fee, deposit, add-ons).
3. As an admin, I can add rules (seasonal/weekend/VIP/location/channel).
4. As an admin, I can preview pricing by selecting dates and seeing the customer view breakdown.
5. As an admin, I can publish pricing; previously created orders keep their pricing.

### Customer

1. As a customer, I can select dates and instantly see a transparent price breakdown.
2. As a customer, I clearly understand min days, included days, deposits, and mandatory fees.
3. As a customer, I can add optional add-ons and see updated totals.

---

## 6. Pricing Calculation Rules (Deterministic)

### 6.1 Duration Model (must be explicit)

Store tenant-level setting:

* `duration_mode`: `CALENDAR_DAYS` | `NIGHTS` | `HOURS_BLOCKS`
* `billing_rounding`: `CEIL` | `FLOOR` | `NEAREST`
* `min_billable_units` default = 1

**Recommended default for fashion rental**: `CALENDAR_DAYS` with `CEIL` (simple + expected).

### 6.2 Evaluation Order

1. Determine billable units (days)
2. Select applicable base **RatePlan** (highest priority among matches)
3. Compute **Base Rental** line item
4. Apply mandatory fees components (cleaning/handling)
5. Apply optional add-ons (customer-selected)
6. Compute deposit components (separate display bucket)
7. Apply discounts/surcharges (as defined by priority + stacking rules)
8. Output totals:

   * `subtotal` (excluding refundable deposit, unless business wants deposit “due now”)
   * `deposit_total`
   * `total_due_now`
   * `total_due_later` (if any components are post-return)

### 6.3 Conflict & Priority

* Every RatePlan and Component has `priority` (integer). Higher wins.
* If two base RatePlans match with same priority → deterministic tiebreaker:

  1. more specific conditions count
  2. lowest `id` (stable)
* Components generally **stack** unless `exclusive_group` is defined.

---

## 7. Data Model (PostgreSQL)

### 7.1 Money Representation

Use **integer minor units** for correctness:

* `amount_minor BIGINT` (e.g., cents)
* `currency CHAR(3)` (ISO-4217)

### 7.2 ERD-Style Schema (ASCII)

```
TENANT (tenant_id)
   |
PRODUCT (product_id, tenant_id, retail_price_minor?, currency)
   |
PRICING_PROFILE (pricing_profile_id, product_id, tenant_id, active_policy_version_id)
   |
PRICE_POLICY_VERSION (policy_version_id, pricing_profile_id, version, status, created_at)
   |-----------------------------|
   |                             |
RATE_PLAN (rate_plan_id, policy_version_id, type, priority, config_jsonb)
PRICE_COMPONENT (component_id, policy_version_id, type, priority, config_jsonb, visibility)
   |                             |
   |                             |
CONDITION_SET (condition_set_id, owner_type, owner_id)  // owner = rate_plan or component
   |
CONDITION (condition_id, condition_set_id, field, operator, value_jsonb)

QUOTE (quote_id, tenant_id, product_id, variant_id, policy_version_id, inputs_hash, created_at, expires_at)
   |
QUOTE_LINE_ITEM (line_item_id, quote_id, type, label, amount_minor, refundable, visibility, metadata_jsonb)

ORDER (order_id, tenant_id, quote_id?, policy_version_id, status, created_at)
   |
ORDER_LINE_ITEM (order_line_item_id, order_id, type, label, amount_minor, refundable, visibility, metadata_jsonb)
```

### 7.3 Core Tables (recommended columns)

**pricing_profile**

* id (uuid)
* tenant_id (uuid)
* product_id (uuid)
* active_policy_version_id (uuid, nullable)
* currency (char(3))
* timezone (text, IANA)
* duration_mode (enum text)
* billing_rounding (enum text)
* created_at, updated_at

**price_policy_version**

* id (uuid)
* pricing_profile_id (uuid)
* version (int)
* status (`DRAFT` | `ACTIVE` | `ARCHIVED`)
* effective_from (timestamptz nullable)
* effective_to (timestamptz nullable)
* published_at (timestamptz nullable)
* created_by (uuid nullable)
* created_at

**rate_plan**

* id (uuid)
* policy_version_id (uuid)
* type (`PER_DAY`|`FLAT_PERIOD`|`TIERED_DAILY`|`WEEKLY_MONTHLY`|`PERCENT_RETAIL`)
* priority (int)
* config (jsonb)  // validated per type
* condition_set_id (uuid nullable)

**price_component**

* id (uuid)
* policy_version_id (uuid)
* type (`FEE`|`DEPOSIT`|`DISCOUNT`|`ADDON`|`SURCHARGE`)
* priority (int)
* visibility (`CUSTOMER`|`STAFF_ONLY`)
* charge_timing (`AT_BOOKING`|`AT_PICKUP`|`AT_RETURN`|`POST_RETURN`)
* refundable (bool)
* exclusive_group (text nullable)
* config (jsonb)
* condition_set_id (uuid nullable)

**condition_set**

* id (uuid)
* owner_type (`RATE_PLAN`|`COMPONENT`)
* owner_id (uuid)

**condition**

* id (uuid)
* condition_set_id (uuid)
* field (e.g., `date_range`, `dow`, `customer_tier`, `channel`, `location`, `duration_days`)
* operator (`EQ`|`IN`|`GTE`|`LTE`|`BETWEEN`|`OVERLAPS`)
* value (jsonb)

**quote**

* id (uuid)
* tenant_id, product_id, variant_id
* policy_version_id
* start_at, end_at (timestamptz)
* customer_context (jsonb)  // tier/channel/location
* selected_addons (jsonb)
* inputs_hash (text)  // stable hash for caching
* currency
* subtotal_minor, deposit_minor, total_due_now_minor, total_due_later_minor
* expires_at
* created_at

**quote_line_item**

* id (uuid)
* quote_id
* type (e.g., `BASE_RENTAL`, `CLEANING_FEE`, `DEPOSIT`, `DISCOUNT`)
* label
* amount_minor
* refundable
* visibility
* metadata (jsonb)

### 7.4 Indexing (performance)

* `rate_plan(policy_version_id, priority desc)`
* `price_component(policy_version_id, priority desc)`
* `condition(condition_set_id)`
* `quote(inputs_hash)` unique per (tenant_id) for dedupe/cache behavior
* `price_policy_version(pricing_profile_id, status, version desc)`
* `order(policy_version_id)`

---

## 8. JSON Policy Version Example (One File Snapshot)

### 8.1 Example: “3-day package + extra day + cleaning + refundable deposit + weekend surcharge”

```json
{
  "policyVersion": {
    "id": "pv_3f2b...",
    "version": 7,
    "status": "ACTIVE",
    "currency": "USD",
    "timezone": "Asia/Dhaka",
    "duration": {
      "mode": "CALENDAR_DAYS",
      "rounding": "CEIL",
      "minUnits": 1
    },
    "presentation": {
      "headlineStrategy": "FROM",
      "showDepositSeparately": true,
      "showItemizedByDefault": false
    }
  },
  "ratePlans": [
    {
      "id": "rp_pkg_3day",
      "type": "FLAT_PERIOD",
      "priority": 100,
      "config": {
        "includedDays": 3,
        "flatPriceMinor": 3500,
        "extraDayPriceMinor": 1200,
        "maxDays": 14
      },
      "conditions": []
    }
  ],
  "components": [
    {
      "id": "cmp_cleaning",
      "type": "FEE",
      "priority": 200,
      "visibility": "CUSTOMER",
      "chargeTiming": "AT_BOOKING",
      "refundable": false,
      "config": {
        "label": "Cleaning fee",
        "pricing": { "mode": "FLAT", "amountMinor": 500 }
      },
      "conditions": []
    },
    {
      "id": "cmp_weekend_surcharge",
      "type": "SURCHARGE",
      "priority": 300,
      "visibility": "CUSTOMER",
      "chargeTiming": "AT_BOOKING",
      "refundable": false,
      "config": {
        "label": "Weekend surcharge",
        "pricing": { "mode": "PERCENT_OF_BASE", "percent": 10, "capMinor": 2000 }
      },
      "conditions": [
        { "field": "dow", "operator": "IN", "value": ["SAT", "SUN"] }
      ]
    },
    {
      "id": "cmp_deposit",
      "type": "DEPOSIT",
      "priority": 400,
      "visibility": "CUSTOMER",
      "chargeTiming": "AT_BOOKING",
      "refundable": true,
      "config": {
        "label": "Refundable security deposit",
        "pricing": { "mode": "FLAT", "amountMinor": 3000 }
      },
      "conditions": []
    },
    {
      "id": "cmp_staff_cost",
      "type": "FEE",
      "priority": 10,
      "visibility": "STAFF_ONLY",
      "chargeTiming": "AT_BOOKING",
      "refundable": false,
      "config": {
        "label": "Internal cost",
        "pricing": { "mode": "FLAT", "amountMinor": 1800 }
      },
      "conditions": []
    }
  ],
  "lateFeePolicy": {
    "enabled": true,
    "graceHours": 2,
    "mode": "PER_DAY",
    "amountMinor": 1500,
    "totalCapMinor": 9000
  },
  "addonsCatalog": [
    {
      "addonId": "ad_tryon",
      "label": "Try-on service",
      "pricing": { "mode": "FLAT", "amountMinor": 800 },
      "visibility": "CUSTOMER"
    },
    {
      "addonId": "ad_insurance",
      "label": "Damage waiver",
      "pricing": { "mode": "PERCENT_OF_BASE", "percent": 7 },
      "visibility": "CUSTOMER"
    }
  ]
}
```

### 8.2 Example: “% of retail with min/max + deposit as % of retail”

```json
{
  "ratePlans": [
    {
      "id": "rp_percent_retail",
      "type": "PERCENT_RETAIL",
      "priority": 100,
      "config": {
        "percent": 12,
        "minPriceMinor": 2000,
        "maxPriceMinor": 8000,
        "basis": "PER_RENTAL"
      },
      "conditions": []
    }
  ],
  "components": [
    {
      "id": "cmp_deposit_pct",
      "type": "DEPOSIT",
      "priority": 200,
      "visibility": "CUSTOMER",
      "chargeTiming": "AT_BOOKING",
      "refundable": true,
      "config": {
        "label": "Refundable deposit",
        "pricing": { "mode": "PERCENT_OF_RETAIL", "percent": 20, "minMinor": 1000, "maxMinor": 15000 }
      }
    }
  ]
}
```

---

## 9. API Design (Node.js)

### 9.1 Quote API

`POST /api/pricing/quote`

**Request**

```json
{
  "tenantId": "t_123",
  "productId": "p_456",
  "variantId": "v_789",
  "startAt": "2026-04-20T10:00:00Z",
  "endAt": "2026-04-23T10:00:00Z",
  "context": { "customerTier": "REGULAR", "channel": "ONLINE", "location": "DHAKA" },
  "selectedAddons": ["ad_tryon"]
}
```

**Response**

```json
{
  "quoteId": "q_abc",
  "policyVersionId": "pv_3f2b...",
  "currency": "USD",
  "duration": { "billableDays": 3 },
  "lineItems": [
    { "type": "BASE_RENTAL", "label": "3-day rental", "amountMinor": 3500, "visibility": "CUSTOMER" },
    { "type": "FEE", "label": "Cleaning fee", "amountMinor": 500, "visibility": "CUSTOMER" },
    { "type": "ADDON", "label": "Try-on service", "amountMinor": 800, "visibility": "CUSTOMER" },
    { "type": "DEPOSIT", "label": "Refundable security deposit", "amountMinor": 3000, "refundable": true, "visibility": "CUSTOMER" }
  ],
  "totals": {
    "subtotalMinor": 4800,
    "depositMinor": 3000,
    "totalDueNowMinor": 7800,
    "totalDueLaterMinor": 0
  },
  "expiresAt": "2026-04-16T12:30:00Z"
}
```

### 9.2 Admin Pricing Publish

* `POST /api/admin/products/:id/pricing/draft`
* `POST /api/admin/pricing-policy/:policyVersionId/publish`
  Publishing sets `ACTIVE`, increments version, updates `pricing_profile.active_policy_version_id`.

---

## 10. Caching & Efficiency (Redis)

### 10.1 Cache Key

Compute stable hash:

* tenantId, productId, variantId
* policyVersionId
* startAt, endAt (normalized)
* context (tier/channel/location)
* selectedAddons (sorted)

Key: `quote:{tenantId}:{inputsHash}` → quote payload

### 10.2 TTL

* Suggested TTL: 5–15 minutes
* If inventory availability affects pricing (rare), include availability version in hash or keep TTL short.

### 10.3 Idempotency

If same request repeats, return cached quote (or DB quote if you persist quotes).

---

## 11. Admin UX Requirements (Next.js)

* **Simple templates** first, advanced toggle.
* “Preview simulator” in pricing step.
* Validation:

  * minDays >= 1
  * includedDays >= 1
  * money values >= 0
  * percent values 0–100
* Warnings:

  * overlapping base plans without priority separation
  * missing retail price when using % retail plan
* Customer preview mode: shows exactly what customers see.

---

## 12. Test Plan (20 Core Cases)

> Assume currency USD, amounts are in minor units (cents). Use deterministic rounding rules.

### Duration & Rounding

1. **CEIL day rounding**: start 10:00, end next day 09:00 → billableDays = 1 (if calendar-days) OR 1 (if ceil 24h blocks). Verify your chosen mode.
2. **Min days enforced**: PER_DAY $10/day minDays=3; rent 2 days → charged 3 days.

### Rate Plan Selection

3. **Single plan match**: FLAT_PERIOD includedDays=3 flat=3500; rent 3 days → base=3500.
4. **Extra days**: same plan rent 5 days → base=3500 + 2*extraDay(1200)=5900.
5. **Tiered daily**: tiers (1–2:1800, 3–5:1400, 6+:1000). Rent 6 days → 2*1800 + 3*1400 + 1*1000.
6. **Weekly/monthly optimizer** (if enabled): weekly=6000, daily=1200. Rent 8 days → 1 week + 1 day (7200) vs 8 days (9600) choose 7200.
7. **% retail min/max**: retail=100000, 12% = 12000, max=8000 → base=8000.

### Conditions & Priority

8. **Weekend surcharge applies**: rental includes Saturday → surcharge computed and added.
9. **Seasonal override base plan**: default PER_DAY $1200, summer PER_DAY $1500 (higher priority). Quote in summer → $1500 used.
10. **Conflicting base plans**: two plans match; higher priority wins.
11. **Tie-breaker deterministic**: equal priority; more specific conditions should win (or stable id). Verify stable output.

### Components & Visibility

12. **Mandatory cleaning fee**: always added once per order.
13. **Optional add-on**: try-on selected → added; not selected → absent.
14. **STAFF_ONLY component hidden**: internal cost exists in policy but does not appear in customer output.

### Deposits

15. **Refundable deposit separate totals**: deposit shows in `depositMinor`, not inside `subtotalMinor` (per presentation setting).
16. **Deposit % retail with min/max**: retail=50000, deposit 20%=10000 but max=8000 → deposit=8000.

### Discounts / Surcharges Stacking

17. **Percent discount on subtotal**: base 5000 + fee 500 => subtotal 5500; discount 10% => -550.
18. **Cap enforcement**: weekend surcharge 10% cap 2000; base 50000 => surcharge should be 2000.

### Late Fee Policy (Return-time)

19. **Late fee grace**: grace 2h; return 1h late → late fee 0.
20. **Late fee cap**: per day 1500 cap 9000; return 10 days late → late fee 9000.

---

## 13. Engineering Notes (avoid future pain)

* **Freeze computed line items** into the ORDER at checkout (`order_line_item`). Never re-evaluate.
* Validate JSON configs via schema (e.g., Zod in Node) per `type`.
* Keep condition evaluation pure and deterministic (no network calls).
* Add an “explain mode” in admin preview that shows which rules matched and why (huge for debugging).
* If you later add taxes: apply after subtotal and before deposit depending on jurisdiction; keep it as another component layer.
