# Feature Spec: Availability Engine

## Overview

The availability engine determines whether a product can be rented for a requested date range. It is the core mechanism that prevents double-booking — ensuring a product cannot be rented to two customers for overlapping dates.

In v1, availability is tracked at the **product level** (not per-size or per-variant).

---

## How Availability Works

### Basic Principle

A product is **available** for a date range if:
1. The product status is **Published** AND availability toggle is **Available**
2. No existing confirmed booking overlaps with the requested date range
3. No try-on booking overlaps with the requested date range

### Date Range Overlap Check

Two date ranges overlap if:
```
existingStart <= requestedEnd AND existingEnd >= requestedStart
```

**Example**:
- Existing booking: April 15 – April 17
- Requested: April 16 – April 18 → **OVERLAPS** (not available)
- Requested: April 18 – April 20 → **NO OVERLAP** (available)
- Requested: April 13 – April 14 → **NO OVERLAP** (available)
- Requested: April 13 – April 15 → **OVERLAPS** (not available)

### Buffer Days (Future Enhancement)

In future, owners can configure buffer days between bookings (e.g., 1 day for cleaning). In v1, bookings can be back-to-back (April 15-17, then April 18-20).

---

## Availability States

### Product-Level States

| State | Meaning | Can Book? |
|---|---|---|
| Published + Available | Product is active and can be rented | Yes (if dates free) |
| Published + Not Available | Product is listed but cannot be booked | No |
| Draft | Product not visible to guests | No |
| Archived | Product hidden | No |

### Date-Level States

For a specific date, the product can be:

| State | Visual | Meaning |
|---|---|---|
| **Free** | Green | No booking exists, can be selected |
| **Booked** | Red | Confirmed booking exists for this date |
| **Pending** | Orange/Yellow | A pending booking exists (not yet confirmed) |
| **Blocked** | Gray | Manually blocked by owner |
| **Past** | Light gray | Date is in the past, cannot be selected |

---

## Calendar Display (Guest Side)

### Product Detail Page — Date Selection

```
📅 Select Your Rental Dates

     April 2026
Mo Tu We Th Fr Sa Su
       1  2  3  4  5
 6  7  8  9 10 11 12
13 14 [15 16 17] 18 19      ← Red: booked
20 21 22 23 24 25 26         ← Green: available
27 28 29 30

[15,16,17 highlighted in red — already booked]
[Other dates in green — available]
```

Guest taps start date, then end date. System highlights the range.

### Interaction Rules

1. Guest cannot select past dates
2. Guest cannot select into a booked range
3. When guest taps start date, only valid end dates are selectable (no overlap with next booking)
4. Selected range is highlighted in a distinct color (e.g., blue)
5. Auto-calculate and show rental cost immediately as dates are selected

### Price Preview on Date Selection

```
Selected: April 20 – April 22 (3 days)
Rental: ৳7,500
Deposit: ৳5,000
```

---

## Availability Check API

### Endpoint: Check Availability

```
GET /api/products/:productId/availability?month=2026-04

Response:
{
  "productId": "prod-001",
  "month": "2026-04",
  "dates": {
    "2026-04-15": "booked",
    "2026-04-16": "booked",
    "2026-04-17": "booked",
    "2026-04-20": "pending",
    "2026-04-21": "pending"
  },
  "isAvailable": true
}
```

Dates not listed are free. This minimizes response size.

### Endpoint: Validate Date Range

```
POST /api/products/:productId/check-availability

Body:
{
  "startDate": "2026-04-20",
  "endDate": "2026-04-22"
}

Response:
{
  "available": true,
  "rentalDays": 3,
  "pricing": {
    "baseRental": 7500,
    "extendedDays": 0,
    "extendedCost": 0,
    "deposit": 5000,
    "cleaningFee": 500,
    "total": 13000
  }
}
```

Or if not available:
```
{
  "available": false,
  "conflictDates": ["2026-04-20", "2026-04-21"],
  "nextAvailable": "2026-04-23"
}
```

---

## Date Blocking by Owner

Owners can manually block dates for a product (e.g., personal use, repairs, photo shoots).

### How It Works

1. Owner goes to product detail → "Manage Availability"
2. Selects dates on calendar
3. Marks as "Blocked" with optional reason
4. Blocked dates appear as unavailable to guests

### Blocked vs. Booked

| Type | Source | Guest Sees | Owner Sees |
|---|---|---|---|
| Booked | Customer booking | Red / "Booked" | Red + customer details |
| Blocked | Owner manual action | Gray / "Unavailable" | Gray + "Blocked: [reason]" |
| Pending | Unconfirmed booking | Orange / "Hold" | Orange + booking details |

---

## Pending Booking Handling

When a booking is placed (status = Pending):
1. Dates are **soft-blocked** — shown as "Pending" in the calendar
2. Other guests see these dates as unavailable (to prevent conflicts during owner review)
3. If owner rejects → dates become free again
4. If owner confirms → dates become "Booked"

**Timeout**: If a pending booking is not acted upon within 24 hours (configurable), system can auto-notify the owner. In v1, no auto-cancellation — owner decides.

---

## Caching Strategy

Availability data is read-heavy (every product page load checks it).

| Action | Cache Impact |
|---|---|
| Page load (check availability) | Read from cache (1 min TTL) |
| Booking created | Invalidate cache for that product |
| Booking cancelled | Invalidate cache for that product |
| Owner blocks dates | Invalidate cache for that product |

---

## Business Rules Summary

1. Availability is product-level (not variant-level or size-level) in v1
2. No overlapping bookings allowed for the same product
3. Pending bookings soft-block dates (other guests cannot select them)
4. Owner can manually block dates
5. Past dates are not selectable
6. Calendar shows availability by month
7. Price auto-calculated when guest selects dates
8. Availability cache has short TTL (1 minute) and invalidates on booking changes
9. No buffer days between bookings in v1
