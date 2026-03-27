# UI Spec: Order Detail (Booking Detail)

## Overview

Full detail view of a single booking/order. The central operational screen for managing a rental.

**Route**: `/dashboard/bookings/:id`

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Bookings    #ORD-2026-0045    Status: 🟢 Confirmed            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Customer                          Order Summary                  │
│  ┌──────────────────────────┐     ┌─────────────────────────┐    │
│  │ Fatima Rahman            │     │ Placed: Apr 13, 10:30 AM│    │
│  │ 📞 01712345678           │     │ Payment: COD            │    │
│  │ 📍 Dhanmondi, Dhaka      │     │ Status: Paid ✅         │    │
│  │ [View Customer Profile]   │     │ Total: ৳13,650         │    │
│  └──────────────────────────┘     └─────────────────────────┘    │
│                                                                   │
│  Items                                                            │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ [Img]  Royal Banarasi Saree                                │   │
│  │        Variant: Ivory Gold (White) · Size: M               │   │
│  │        Dates: Apr 15 → Apr 17 (3 days)                     │   │
│  │        Rental: ৳7,500 · Cleaning: ৳500 · Backup(L): ৳300  │   │
│  │        Deposit: ৳5,000 · Status: Collected                 │   │
│  │        Item Total: ৳13,300                                 │   │
│  │        [Inspect Item ▾] [Manage Deposit ▾]                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Price Breakdown                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Subtotal:          ৳7,500                                  │   │
│  │ Cleaning fee:        ৳500                                  │   │
│  │ Backup size:         ৳300                                  │   │
│  │ Shipping:            ৳150                                  │   │
│  │ Deposit:           ৳5,000                                  │   │
│  │ Late fee:              ৳0                                  │   │
│  │ ──────────────────────────                                 │   │
│  │ Grand Total:      ৳13,450                                  │   │
│  │ Paid:             ৳13,450                                  │   │
│  │ Balance:               ৳0                                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Payments                                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ৳13,450 · COD · Verified · Apr 17, 12:00 PM               │   │
│  │ Recorded by: Hana Rahman                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│  [+ Record Payment]                                               │
│                                                                   │
│  Timeline                                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ● Apr 13, 10:30 — Booking placed                          │   │
│  │ ● Apr 13, 11:00 — Confirmed by Hana                       │   │
│  │ ● Apr 14, 09:00 — Shipped via Pathao (PTHO-123456)        │   │
│  │ ● Apr 15, 10:00 — Delivered                                │   │
│  │ ○ Apr 17 — Return due                                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Internal Notes                                                   │
│  Customer prefers morning delivery.                               │
│  [+ Add Note]                                                     │
│                                                                   │
│  Actions                                                          │
│  [Ship Order] [Mark Delivered] [Cancel Order]                     │
│  [Print Invoice]                                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Action Modals

### Ship Order Modal

```
Ship Order #ORD-2026-0045
─────────────────────────
Courier:  [Pathao ▾]
Tracking: [_____________] (auto-filled if API used)

☑ Create parcel via Pathao API

[Cancel]  [Ship & Notify Customer]
```

### Record Payment Modal

```
Record Payment
──────────────
Amount:        [৳ 13,450          ]
Method:        [COD ▾]
Transaction ID: [                  ] (optional)
Notes:         [                  ]

[Cancel]  [Record Payment]
```

### Manage Deposit Modal

```
Deposit: ৳5,000 — Status: Collected

Action: [Refund ▾]
Refund Amount:   [৳ 4,500          ]
Deduction:       ৳500 (auto-calculated)
Reason:          [Minor stain       ]
Refund Method:   [bKash ▾]

[Cancel]  [Process Refund]
```

### Report Damage Modal

```
Damage Report — Royal Banarasi Saree
─────────────────────────────────────
Damage Level:  [Moderate ▾]
Description:   [Small tear on pallu...            ]
Repair Cost:   [৳ 2,000                           ]
Deduction:     [৳ 2,000                           ]
Additional:    [৳ 0                                ]

Photos: [Upload] [Upload]

[Cancel]  [Submit Report]
```
