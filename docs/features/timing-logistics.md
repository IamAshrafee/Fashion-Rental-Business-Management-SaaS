# Feature Spec: Timing & Logistics

## Overview

Controls the timing rules and shipping configuration for product rentals. Handles what happens when a customer keeps a product longer than agreed, returns it late, or needs delivery.

---

## Extended Rental

### Purpose
Allows customers to keep a product beyond the base rental duration at an agreed-upon per-day rate. Unlike late fees, extended rentals are **planned and paid upfront** (e.g., customer knows they need the dress for a destination wedding and will be traveling for 10 days).

### Configuration (Owner)

| Field | Type | Required | Example |
|---|---|---|---|
| Extended Rental Rate | Number (৳ per day) | No | 1,500৳/day |

If not set → extended rental is not available. Customer can only book for the base duration.

### How It Works

For **One-Time Rental** and **Retail Percentage** pricing modes:
1. Product has a base duration (e.g., 3 days included)
2. Customer selects a longer date range (e.g., 7 days)
3. Extra days = 7 - 3 = 4 days
4. Extra cost = 4 × 1,500 = ৳6,000
5. Total rental = Base price + Extended cost

For **Per-Day** pricing mode:
- Extended rental rate is NOT applicable — all days are already priced per day
- This field is hidden when pricing mode is per-day

### Display Rules (Guest Side)
- On date selection: When guest picks dates exceeding base duration, show:
  ```
  Base rental (3 days): ৳7,500
  Extended (4 extra days × ৳1,500): ৳6,000
  ─────────────────────────
  Total rental: ৳13,500
  ```

### Business Rules
1. Only applies to one-time and percentage pricing modes
2. Extended rental is planned and paid at checkout
3. No upper limit on extra days (owner can set a maximum in future)
4. Extended rate can differ from the per-day equivalent of the base price

---

## Late Fees

### Purpose
Penalties for returning a product after the agreed return date. Unlike extended rental, late returns are **unplanned** and punitive.

### Configuration (Owner)

Two modes available:

#### Mode A: Fixed Amount Per Day

| Field | Type | Required | Example |
|---|---|---|---|
| Late Fee Type | Selection | Yes (if enabling) | "fixed" |
| Late Fee Per Day | Number (৳) | Yes | 1,000৳/day |

#### Mode B: Percentage of Retail Price Per Day

| Field | Type | Required | Example |
|---|---|---|---|
| Late Fee Type | Selection | Yes (if enabling) | "percentage" |
| Late Fee Percentage | Number (%) | Yes | 5% of retail price per day |

If retail price = ৳45,000 → Late fee = ৳2,250/day

#### Maximum Late Fee Cap (Optional)
| Field | Type | Required | Example |
|---|---|---|---|
| Max Late Fee | Number (৳) | No | 20,000৳ |

If set, late fees stop accumulating after reaching this cap.
If not set, late fees accumulate until reaching the retail/purchase price.

### How Late Fees Are Applied
1. Return date passes → order marked as **Overdue**
2. System calculates late days
3. Late fee accumulated daily
4. Owner can manually apply or waive late fees
5. Late fee added to order balance
6. Deposit can be used to cover late fees (owner decision)

### Display Rules
- On product detail page: "Late return fee: ৳1,000/day" (if set)
- On booking confirmation: Reminder of return date and late fee policy
- In order management (owner): Accumulated late fee shown on overdue orders

### Business Rules
1. Late fees are calculated from the day after the return date
2. Late fees can be manually waived or adjusted by the owner
3. Late fees can be deducted from the security deposit
4. If late fees + damage exceed deposit → customer owes the difference
5. System sends return reminder notification 1 day before return date

---

## Shipping Policy

### Purpose
Configure how delivery costs are handled. This is flexible because some businesses offer free shipping, some charge a flat rate, and some calculate based on customer location.

### Configuration (Owner)

| Field | Type | Required | Description |
|---|---|---|---|
| Shipping Mode | Selection | No | How shipping cost is determined |

**Shipping Modes**:

#### Mode 1: Free Shipping
No shipping charge. Good for local businesses.

#### Mode 2: Flat Rate
| Field | Type | Example |
|---|---|---|
| Shipping Fee | Number (৳) | 150৳ |

Same fee regardless of location.

#### Mode 3: Area-Based (Calculated Later)
Shipping cost is determined after order placement based on customer's delivery area. Customer sees "Shipping: Calculated after order" at checkout.

The owner manually sets the shipping cost when processing the order, or it's calculated via courier integration (see [courier-integration.md](../features/courier-integration.md)).

### Display Rules

| Mode | Product Page | Checkout |
|---|---|---|
| Free | "Free Shipping" badge | Shipping: ৳0 |
| Flat Rate | "Shipping: ৳150" | Shipping: ৳150 |
| Area-Based | "Shipping: Based on location" | Shipping: To be confirmed |
| Not set | Nothing shown | Nothing shown |

### Business Rules
1. Shipping policy is per product (different products can have different shipping rules)
2. If area-based, the final total is confirmed after order review by owner
3. Flat rate applies per product (2 products = 2× shipping fee — unless owner bundles)
4. Free shipping is a trust/conversion signal — prominently displayed

---

## Return Policy Display

The return process details should be visible to customers to build trust.

### What to Show on Product Detail Page (Trust Section)

```
📦 Shipping & Returns
• Free shipping on all orders / Flat rate: ৳150 / Calculated by area
• Return before [return date] to avoid late fees
• Late return: ৳1,000/day
• Pre-paid return label included (if applicable)
```

---

## Business Rules Summary

1. Extended rental = planned, paid upfront, per-day rate
2. Late fee = unplanned, punitive, per-day or percentage-based
3. Extended rental only applies to one-time and percentage pricing modes
4. Late fees can be capped at a maximum amount
5. Shipping can be free, flat rate, or area-based
6. All timing/logistics fields are optional — empty means not applied
7. Return reminder sent 1 day before return date
