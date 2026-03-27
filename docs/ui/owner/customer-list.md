# UI Spec: Customer List

## Overview

Customer directory with search, booking history, and tagging.

**Route**: `/dashboard/customers`

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Customers (45)                                                    │
├──────────────────────────────────────────────────────────────────┤
│ [Search by name or phone..._____]   Tag: [All ▾]                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────┬─────────────────┬────────────┬──────┬────────┬───────┐  │
│ │      │ Customer        │ Phone      │ Orders│ Spent  │ Last  │  │
│ ├──────┼─────────────────┼────────────┼──────┼────────┼───────┤  │
│ │ 👤   │ Fatima Rahman   │01712345678 │  5   │ ৳42.5K │ Apr 10│  │
│ │      │ [VIP]           │            │      │        │       │  │
│ ├──────┼─────────────────┼────────────┼──────┼────────┼───────┤  │
│ │ 👤   │ Anika Hasan     │01812345678 │  3   │ ৳25K   │ Apr 8 │  │
│ ├──────┼─────────────────┼────────────┼──────┼────────┼───────┤  │
│ │ 👤   │ Rashida Begum   │01612345678 │  1   │ ৳12K   │ Mar 20│  │
│ │      │ [New]           │            │      │        │       │  │
│ └──────┴─────────────────┴────────────┴──────┴────────┴───────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Customer Detail (Side Panel or New Page)

Click a customer row → opens detail:

```
┌──────────────────────────────────────────────────────┐
│ Fatima Rahman                               [VIP ✕]  │
│ 📞 01712345678                     [+ Add Tag]       │
│ ✉️ fatima@email.com                                   │
│ 📍 Dhanmondi, Dhaka                                  │
│                                                       │
│ Stats: 5 orders · ৳42,500 spent · Customer since Jan │
│                                                       │
│ Notes:                                                │
│ Prefers morning delivery. Very reliable customer.    │
│ [Edit Notes]                                         │
│                                                       │
│ Booking History                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ #ORD-0045 · Apr 13 · ৳13,650 · ✅ Completed    │  │
│ │ #ORD-0038 · Mar 20 · ৳8,500  · ✅ Completed    │  │
│ │ #ORD-0025 · Feb 10 · ৳12,000 · ✅ Completed    │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Mobile Layout

Cards instead of table rows with key info and tap-to-expand detail.
