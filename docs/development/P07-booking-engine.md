# P07 — Booking & Availability Engine (Backend)

| | |
|---|---|
| **Phase** | 3 — Transaction Engine |
| **Estimated Time** | 5–6 hours |
| **Requires** | P04 (products, pricing), P05 (customers) |
| **Unlocks** | P08, P09, P14, P18 |
| **Agent Skills** | `nestjs-best-practices`, `nestjs-expert`, `postgresql-best-practices` · Optional: `redis-best-practices` |

---

## REFERENCE DOCS

**Feature specs:**
- `docs/features/availability-engine.md` — Date blocking, overlap detection
- `docs/features/booking-system.md` — Booking lifecycle
- `docs/features/cart-system.md` — Client-side cart validation
- `docs/features/checkout-flow.md` — Checkout process
- `docs/features/timing-logistics.md` — Buffer days, extended rentals

**Database:**
- `docs/database/booking.md` — bookings + date_blocks tables
- `docs/database/booking-item.md` — booking_items + damage_reports

**API:**
- `docs/api/booking.md` — Booking endpoints
- `docs/api/order.md` — Order management endpoints

**Flows:**
- `docs/flows/guest-booking-flow.md` — Guest checkout flow
- `docs/flows/late-return-flow.md` — Late return handling

**Architecture decisions:**
- ADR-02: No separate orders table — booking IS the order
- ADR-03: Client-side cart (localStorage)
- ADR-06: Database-level exclusion constraint for concurrency

---

## SCOPE

### 1. Availability Engine

**Check availability:**
- `GET /api/v1/products/:id/availability?month=2026-04` — returns blocked date ranges for a month
- Query `date_blocks` table for product
- Include buffer days (from `store_settings.buffer_days`) — extend blocked ranges

**Overlap detection:**
- Given product_id + start_date + end_date → return boolean (available or not)
- Must account for buffer days on both sides
- Database exclusion constraint prevents concurrent insertions

### 2. Cart Validation Endpoint

Cart lives in localStorage (ADR-03), but server validates before checkout:

```typescript
POST /api/v1/bookings/validate
Body: {
  items: [
    { productId, variantId, startDate, endDate, sizeInfo? },
    ...
  ]
}
Response: {
  valid: boolean,
  items: [
    {
      productId, available, rentalPrice, deposit, cleaningFee,
      extendedDays, extendedCost, itemTotal, errors?
    }
  ],
  summary: { subtotal, totalFees, totalDeposit, grandTotal }
}
```

### 3. Booking Creation (Atomic)

```typescript
POST /api/v1/bookings
Body: {
  items: [...], // same as validate
  delivery: { name, phone, altPhone, addressLine1, city, state, postalCode, country, extra },
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'sslcommerz',
  customerNotes?: string
}
```

**Atomic operation (transaction):**
1. Find or create customer by phone (via P05 `CustomerService`)
2. Validate all items availability (re-check)
3. Create booking record
4. Create booking_items (snapshot product data at booking time)
5. Create date_blocks for each item (exclusion constraint prevents double-booking)
6. Generate booking_number (`#ORD-{YEAR}-{SEQUENCE}`)
7. Calculate all prices (snapshot pricing at booking time)
8. Emit `booking.created` event
9. Return booking with confirmation details

**If anything fails → full rollback (Prisma transaction)**

### 4. Booking Lifecycle State Machine

```
pending → confirmed → shipped → delivered → returned → inspected → completed
                ↘ cancelled                    ↘ overdue → returned → ...
```

**Status transition endpoints:**
- `PATCH /api/v1/bookings/:id/confirm` — owner confirms
- `PATCH /api/v1/bookings/:id/cancel` — owner or customer cancels
- `PATCH /api/v1/bookings/:id/ship` — owner marks shipped (with tracking number)
- `PATCH /api/v1/bookings/:id/deliver` — owner marks delivered
- `PATCH /api/v1/bookings/:id/return` — owner marks returned
- `PATCH /api/v1/bookings/:id/inspect` — owner marks inspected (with optional damage report)
- `PATCH /api/v1/bookings/:id/complete` — owner marks completed (deposits refunded)

**Each transition:**
- Validates current status allows this transition
- Updates timestamp (confirmedAt, shippedAt, etc.)
- Emits event (`booking.confirmed`, `booking.shipped`, etc.)
- Updates product stats (total_bookings, total_revenue) on completion
- Updates customer stats on completion

### 5. Booking Queries

- `GET /api/v1/bookings` — paginated list, filterable by status, date range, customer
- `GET /api/v1/bookings/:id` — full booking detail with items, customer, payments
- `GET /api/v1/bookings/stats` — dashboard stats (pending count, today's deliveries, overdue count)

### 6. Booking Number Generation

- Format: `#ORD-{YYYY}-{SEQUENCE}` (e.g., `#ORD-2026-0045`)
- Sequence is per-tenant, per-year
- Atomic increment to prevent duplicates

### 7. Late Fee Calculation

- When booking is marked overdue or returned late:
- Calculate late_days = actual_return_date - expected_return_date
- Calculate late_fee based on product's late fee config (fixed per day or percentage)
- Cap at max_late_fee if configured
- Update booking_item.late_fee and booking_item.late_days

### 8. Cancellation Logic

- Pending bookings: customer or owner can cancel freely
- Confirmed bookings: only owner can cancel (require reason)
- Shipped or later: cannot cancel
- On cancellation: release date_blocks, update booking status, emit event

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Availability check API | Returns blocked dates per product/month |
| 2 | Cart validation endpoint | Validates items + calculates prices |
| 3 | Booking creation (atomic) | Creates booking + items + date_blocks in transaction |
| 4 | Status transition endpoints | All 7 transitions with validation |
| 5 | Booking queries | List, detail, stats |
| 6 | Booking number generator | Unique sequential numbers per tenant |
| 7 | Late fee calculation | Correct late fees applied |
| 8 | Cancellation + date_block release | Cancelling releases dates |
| 9 | Event emissions | All booking lifecycle events fired |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Availability API | P18 (Guest checkout — availability calendar) |
| Cart validation API | P18 (Guest checkout — price calculation) |
| Booking creation API | P18 (Guest checkout — place booking) |
| Status transition APIs | P14 (Owner booking management UI) |
| Booking queries | P14 (Owner booking list/detail) |
| `booking.created` event | P10 (notifications — SMS, in-app) |
| `booking.confirmed` event | P10 (notifications) |
| Booking data for payment | P08 (payment recording) |
