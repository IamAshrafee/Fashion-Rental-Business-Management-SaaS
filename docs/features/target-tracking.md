# Feature Spec: Target Tracking

## Overview

An internal business tool that helps owners track how many rentals are needed to recover the purchase cost of a product. This is purely an owner-side feature — never visible to guests.

---

## Configuration (Owner)

| Field | Type | Required | Description |
|---|---|---|---|
| Target Rental Count | Number | No | How many rentals needed to recover cost |

### Auto-Calculation

If the owner does not manually set a target, the system auto-calculates:

```
targetRentals = ceil(purchasePrice / rentalPrice)
```

**Example**:
- Purchase price: ৳20,000
- Rental price: ৳5,000
- Auto-calculated target: 4 rentals

**Requirements for auto-calculation**:
- Product must have a purchase price set
- Product must have a rental price set

If either is missing → target shows as "Not set" and cannot be auto-calculated.

### Manual Override

Owner can set a custom target that overrides the auto-calculated value.

**Use case**: Owner may want to factor in additional costs (cleaning, repairs) beyond the purchase price, or may have a different business goal.

---

## Progress Tracking

### Data Points

| Metric | How Calculated |
|---|---|
| Target Rentals | Manually set or auto-calculated |
| Completed Rentals | Count of completed orders (status = Completed) for this product |
| Revenue Earned | Sum of rental income from completed orders (excludes deposit) |
| Purchase Price | From product internal fields |
| Recovery Percentage | (Revenue Earned / Purchase Price) × 100 |

### Display (Owner Portal — Product Detail)

```
📊 Target Recovery
────────────────────
Purchase Cost: ৳20,000
Revenue Earned: ৳10,000

Progress: ████████░░░░░░░░ 50%

Completed: 2 / 4 rentals
Remaining: 2 more rentals to break even
```

### Display (Owner Portal — Product List)

A compact indicator on the product list:

- `2/4` with a small progress bar
- Color coded:
  - Red: < 25% recovered
  - Orange: 25-75% recovered
  - Green: 75-99% recovered
  - Blue/Gold: 100%+ recovered (profit zone)

---

## After Target Is Reached

When completed rentals ≥ target:

- Progress bar shows 100% or beyond
- Label changes to: "✅ Target reached — now in profit"
- Continued rentals contribute to pure profit tracking
- No automatic action is triggered — this is informational only

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No purchase price set | Target shows "Not set — add purchase price to track" |
| No rental price set | Auto-calculation unavailable, manual target only |
| Rental price changes after some bookings | Target recalculated based on current price, but completed count stays |
| Product has multiple pricing modes | Use the primary rental price for calculation |
| Cancelled/refunded booking | Not counted toward completed rentals |
| Try-on order (no full rental) | Not counted toward target |

---

## Business Rules Summary

1. Target tracking is internal only — never visible to guests
2. Auto-calculated if both purchase price and rental price are set
3. Owner can manually override the target
4. Only completed orders count toward progress
5. Revenue tracking excludes deposits and fees — only rental income
6. Progress continues tracking beyond 100% (profit tracking)
7. Purely informational — no automated actions triggered
