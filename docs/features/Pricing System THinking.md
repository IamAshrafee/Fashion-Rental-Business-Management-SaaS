# Fashion Rental SaaS — Pricing System Design (Product Add Module)

## 1) Problem Statement

Fashion rental pricing is rarely “price × days.” Real-world operators combine:

* **Base rental** (per-day, fixed period, tiered, weekly, % of retail, etc.)
* **Minimum rental days**, included days, partial day rules
* **Add-ons** (cleaning, try-on, insurance, delivery, accessories)
* **Deposits** (refundable, conditional, % of retail)
* **Late fees** (grace period, per day, caps)
* **Internal pricing** (staff/cost) not shown to customers
* **Special rules** (weekends, seasons, events, customer tiers, location/channel)

Goal: Create a pricing module that is:

* **Configurable** for wide user base (SaaS)
* **Transparent** to customers (easy to understand + trust)
* **Deterministic** (same inputs → same quote)
* **Versioned** (quotes remain valid even if pricing changes)
* **Extensible** (new pricing models added later without breaking schema)

---

## 2) Strategy: Split “Pricing Definition” from “Pricing Evaluation”

### Core concept

**Store pricing as a set of composable components + rules**, then run a **pricing engine** to generate an **itemized quote**.

**Why this wins for SaaS**

* You can support “almost anything” through configuration.
* UI can present common templates (simple) and still allow advanced setups.
* You avoid hardcoding pricing modes everywhere.

---

## 3) Terminology (Use consistent words in UI + code)

* **Rate Plan**: How base rental price is calculated (per day, flat period, tiered, % retail, etc.)
* **Price Components**: Line items that can add/subtract money (base rental, cleaning fee, deposit, add-ons, discounts)
* **Rules / Conditions**: When a plan/component applies (season, DOW, customer tier, location, date range)
* **Quote**: Itemized computed output for a given product + dates + customer context
* **Price Policy Version**: Snapshot of pricing rules used for a quote/order (for audit and stability)

---

## 4) Requirements

### Must-have (MVP but SaaS-grade)

1. Multiple base pricing styles:

   * Per-day with minimum days
   * Fixed “X-day package” (e.g., 3-day rental)
   * Tiered daily rates (day 1–2 one price, day 3–5 another…)
   * Weekly/monthly pricing
   * % of retail price (with floors/caps)
2. Optional one-time fees (cleaning, handling, setup)
3. Refundable security deposit (fixed or % of retail)
4. Late fee policy (grace + per-day + cap)
5. Internal pricing fields (staff-only, not customer-visible)
6. Customer-facing display that is **simple** + “show details” breakdown

### Nice-to-have (Phase 2)

* Delivery/pickup rules by zone
* Membership/plan-based pricing
* Auto-suggest “best plan” (e.g., daily vs weekly)
* “Try-on service” workflows
* Damage/repair fee handling (post-rental)

---

## 5) High-Level Architecture

### 5.1 Data Objects

**Product**

* retail_price (optional but recommended)
* category, brand, etc.

**Variant / Inventory Unit**

* size, color, sku
* availability & buffers

**PricingProfile** (attached to Product or to Category template)

* `currency`
* `timezone`
* `price_policy_versions[]` (active + historical)

**PricePolicyVersion**

* `version_id`
* `effective_from`, `effective_to` (optional)
* `rate_plans[]`
* `components[]` (fees, deposits, add-ons)
* `rules[]` (season/weekend/customer tier/etc.)
* `presentation_settings` (how to show “From” price)

> Key: Every order stores `version_id` so future edits don’t change past orders.

---

## 6) Universal Model: Price Components + Rule Conditions

### 6.1 Component Types (Line items)

Each component produces a **line item**:

* **Base Rental Charge** (computed by selected Rate Plan)
* **Fees** (one-time or per-day/per-order)
* **Deposits** (refundable, held, or charged)
* **Discounts/Surcharges** (absolute or percentage)
* **Add-ons** (optional selectable items)

Each component has:

* `visibility`: CUSTOMER | STAFF_ONLY
* `charge_timing`: AT_BOOKING | AT_PICKUP | AT_RETURN | POST_RETURN
* `refundable`: true/false (primarily for deposit)
* `stacking_priority` (order of application)
* `tax_category` (if you support tax later)

### 6.2 Conditions (Rules)

A condition decides when a component applies. Common condition fields:

* Date range (seasonal)
* Day of week (weekend pricing)
* Customer segment/tier (VIP pricing)
* Channel (in-store vs online)
* Location (branch-based price books)
* Duration thresholds (min days, weekend-only packages)

---

## 7) Rate Plan Types (Base Rental Pricing)

Instead of “three pricing modes,” implement **templates** backed by a single engine. Recommended set:

### A) PER_DAY

* `unit_price_per_day`
* `min_days`
* Optional: `max_days`, `rounding` (ceil to day)

### B) FLAT_PERIOD (Package pricing)

* `included_days` (e.g., 3-day package)
* `flat_price`
* `extra_day_price` (optional)
* Example: “One-time rental” is usually this.

### C) TIERED_DAILY (Price ladder)

* tiers:

  * day 1–2: $X/day
  * day 3–5: $Y/day
  * day 6+: $Z/day
* Supports volume discounts naturally.

### D) WEEKLY / MONTHLY

* `weekly_price`, `monthly_price`
* Optional: `fallback_daily_price`
* Engine chooses best combination if enabled (“optimize cost” toggle)

### E) PERCENT_OF_RETAIL

* `percent` (e.g., 10% of retail)
* `min_price`, `max_price`
* Optional: tie to duration (per day vs per rental)

### F) CUSTOM_FORMULA (Advanced / future-proof)

* A safe expression format (not raw code), e.g.:

  * `base = max(min_price, retail_price * 0.12)`
  * `base += (days - 3) * extra_day_price`
* You can implement later; keep schema ready.

**Important:** In UI, you show these as “Pricing Templates,” not “modes.”

---

## 8) Quote Calculation (Deterministic Engine)

### 8.1 Inputs

* product_id, variant_id (size)
* start_datetime, end_datetime (or start + duration)
* customer context: segment, channel, location
* selected add-ons (optional)
* coupon/promo (optional)

### 8.2 Steps (Recommended order)

1. **Compute rental duration** in “billable units”

   * Typically `billable_days = ceil((end-start)/24h)` or “count nights”
   * Configurable per tenant (some do 1-day minimum always)
2. **Choose applicable Rate Plan**

   * Evaluate conditions (season/weekend/customer tier)
   * If multiple match, pick highest priority
3. **Compute Base Rental line item**
4. **Apply mandatory fees** (cleaning, service)
5. **Apply optional add-ons** selected by customer
6. **Compute deposit** (if required)
7. **Apply discounts/surcharges** (promo, VIP, seasonal surcharge)
8. **Return itemized breakdown** + totals:

   * `subtotal`
   * `deposit_total` (separate display)
   * `total_due_now`
   * `total_due_later` (if any)
9. **Freeze pricing** by storing `PricePolicyVersion` reference in the order/quote record

### 8.3 Output Format (Example)

* Base rental (3 days × $12/day) = $36
* Cleaning fee (one-time) = $5
* Weekend surcharge (10%) = $4.10
* Deposit (refundable) = $30
* Total due now = $45.10
* Deposit held = $30 (refundable)

This format is critical for customer trust.

---

## 9) Product Add Module UX (Admin)

### 9.1 The UI that scales for SaaS

Use a **2-level UI**:

1. **Simple Mode (Templates)** — for most merchants
2. **Advanced Mode (Components + Rules)** — for power users

### 9.2 Admin Flow (Recommended)

**Step 1: Pricing Template**

* Per day
* Package (flat for X days)
* Tiered daily
* Weekly/monthly
* % of retail
* Advanced

**Step 2: Required Fields**

* Currency
* Base values (price/day, min days, etc.)

**Step 3: Optional Components**
Toggle-able blocks:

* Cleaning fee (one-time)
* Security deposit (fixed or % of retail)
* Try-on fee
* Late fee policy
* Internal pricing (staff-only cost / staff price)
* Add-ons list (insurance, accessories)

**Step 4: Rules (Optional)**

* Weekend pricing
* Seasonal pricing
* VIP pricing
* Location/channel overrides

**Step 5: Preview**
A small simulator:

* Pick dates + customer tier
* Show “customer view” + breakdown
  This prevents misconfiguration.

---

## 10) Customer-Facing Display (Product Details Page)

### 10.1 Keep it simple at first glance

Show a single “headline price”:

* **“From $12/day (min 3 days)”**
  or
* **“3-day rental: $39 (extra day: $10)”**

### 10.2 Always include an estimator

A date picker on PDP or at least at checkout:

* Select start/end → show **itemized quote**
* Show deposit clearly as refundable/hold

### 10.3 Avoid confusion

* Don’t show 6 different prices without context.
* Always reveal: min days, included days, extra day price, and mandatory fees.

---

## 11) Late Fee Policy (Phase 1 but separate from base pricing)

Late fees are better modeled as a **policy**, not a rate plan.

**LateFeePolicy**

* grace_period_hours (e.g., 2 hours)
* late_fee_type: PER_DAY | FLAT | PERCENT_BASE
* late_fee_value
* daily_cap / total_cap
* max_late_days (optional)

Late fee is computed at return-time (or auto-extends rental if your business does that).

---

## 12) Internal Pricing (Staff-only)

Add staff-visible fields:

* cost_price (COGS estimate)
* staff_rental_price override (optional)
* internal_notes

Ensure `visibility=STAFF_ONLY` at component level.

---

## 13) Extensibility Principles (How you get “100% possible” without chaos)

You can’t truly predict every future pricing idea, but you *can* guarantee extensibility if you:

1. Keep pricing as **data/config**, not code branches
2. Use **components** (line items) + **conditions**
3. Store **versioned policies**
4. Have a stable **Quote API** and **line item schema**
5. Allow **new component types** later without breaking orders

---

## 14) Minimum “Developer Spec” (What you implement first)

### 14.1 Tables / Models (minimum)

* products
* variants
* pricing_profiles
* price_policy_versions
* rate_plans
* price_components
* component_conditions
* quotes (optional cache)
* orders (store policy_version_id + computed line items)

### 14.2 APIs

* `POST /pricing/quote`
* `GET /products/:id/pricing-preview` (admin tool)
* `POST /admin/products/:id/pricing` (save policy version)

### 14.3 Engine

* Deterministic evaluation order
* Clear priority resolution
* Rounding rules centralized
* Unit-tested with scenarios

---

## 15) Example Configurations (Proves flexibility)

### Example 1: “One-time rental (3 days)”

* Rate plan: FLAT_PERIOD (included_days=3, flat_price=35, extra_day_price=12)
* Component: cleaning fee $5
* Deposit: $30 refundable

### Example 2: “Per day with minimum days”

* PER_DAY: $10/day, min_days=2
* Weekend surcharge: +15% (condition: Sat/Sun in range)

### Example 3: “% of retail”

* PERCENT_OF_RETAIL: 12% of retail, min $20, max $80
* Deposit: 20% of retail (refundable)

### Example 4: “Tiered daily”

* Day 1–2: $18/day
* Day 3–5: $14/day
* Day 6+: $10/day

---

## 16) Practical Recommendation (If you must choose a “best approach”)

Implement **Pricing Templates backed by a Component+Rules engine**.

That gives you:

* Easy onboarding (templates)
* Power-user flexibility (advanced)
* Clean customer UX (itemized quote)
* SaaS scalability (versioning, extensibility)