# UI Spec: Booking Management

## Overview

List of all bookings with status filtering. The primary operations view for the owner.

**Route**: `/dashboard/bookings`

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Bookings (234)                                                    │
├──────────────────────────────────────────────────────────────────┤
│ [Search by order # or name...____]                                │
│                                                                   │
│ [All(234)] [Pending(2)] [Confirmed(5)] [Shipped(3)] [Delivered(8)]│
│ [Overdue(1)] [Returned(3)] [Inspected(2)] [Completed(210)]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ #ORD-2026-0045  ·  🟡 Pending              5 min ago       │  │
│ │ Fatima Rahman · 01712345678                                 │  │
│ │ Royal Banarasi Saree (White, M) · Apr 15-17                 │  │
│ │ ৳13,650 · COD · Unpaid                                     │  │
│ │ [Confirm] [Cancel]                                          │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ #ORD-2026-0044  ·  🟢 Confirmed             1 hour ago     │  │
│ │ Anika Hasan · 01812345678                                   │  │
│ │ Evening Gown (Red) · Apr 20-22                              │  │
│ │ ৳9,100 · bKash · Paid ✅                                   │  │
│ │ [Ship Order]                                                │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ #ORD-2026-0040  ·  🔴 Overdue               2 days ago     │  │
│ │ Rashida Begum · 01612345678                                 │  │
│ │ Bridal Lehenga (Gold) · Apr 10-12                           │  │
│ │ ৳25,000 · COD · Paid · ⚠️ Return was due Apr 12            │  │
│ │ [Mark Returned] [Contact Customer]                          │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Status Tab Colors

| Status | Tab Color | Card Accent |
|---|---|---|
| Pending | Yellow | Yellow left border |
| Confirmed | Blue | Blue left border |
| Shipped | Indigo | Indigo left border |
| Delivered | Teal | Teal left border |
| Overdue | Red | Red left border + red background tint |
| Returned | Purple | Purple left border |
| Inspected | Orange | Orange left border |
| Completed | Green | Green left border |
| Cancelled | Gray | Gray, muted text |

---

## Quick Actions Per Status

| Status | Actions Shown |
|---|---|
| Pending | [Confirm] [Cancel] |
| Confirmed | [Ship Order] [Cancel] |
| Shipped | [Mark Delivered] |
| Delivered | [Mark Returned] |
| Overdue | [Mark Returned] [Contact] |
| Returned | [Start Inspection] |
| Inspected | [Complete] |

Click any card → opens full [order detail](./order-management.md).

---

## Mobile Layout

Same card layout, full-width stacked. Status tabs become a scrollable horizontal pill bar.
