# UI Spec: Edit Product

## Overview

Same form structure as Add Product, but pre-filled with existing data. All steps accessible directly via tabs instead of a wizard flow.

**Route**: `/dashboard/products/:id/edit`

---

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ ← Products    Edit: Royal Banarasi Saree    [Preview →]    │
├────────────────────────────────────────────────────────────┤
│ [Basic] [Variants] [Images] [Pricing] [Size] [Services]   │
│ [Details] [FAQ] [Availability]                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Selected tab content — same forms as Add Product]        │
│                                                            │
│  Changes are auto-saved.                                   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Status: Published ●    [Unpublish] [Archive] [Delete]      │
└────────────────────────────────────────────────────────────┘
```

---

## Key Differences from Add Product

| Feature | Add | Edit |
|---|---|---|
| Navigation | Step-by-step wizard | Tabs (any order) |
| Save | Save at the end | Auto-save per tab |
| Status actions | Save as Draft / Publish | Unpublish / Archive / Delete |
| Availability tab | Not shown | Shows calendar with existing bookings |
| Preview | In review step | "Preview" button opens storefront view |

---

## Availability Tab (Edit Only)

Shows the product's availability calendar with existing bookings and manual blocks:

```
Availability Calendar
──────────────────────

[← March 2026]  [April 2026]  [May 2026 →]

Mon  Tue  Wed  Thu  Fri  Sat  Sun
                1    2    3    4
 5    6    7    8    9   10   11
12   13   14   🔴  🔴  🔴   17
18   🟡  🟡   20   21   22   23
24   25   26   27   28   29   30

🔴 Booked (#ORD-0045 — Fatima Rahman)
🟡 Pending (#ORD-0048 — Anika Hasan)
⬛ Blocked (Dry cleaning)

[+ Block Dates]
```

---

## Delete Confirmation

```
⚠️ Delete "Royal Banarasi Saree"?

This product has 12 past bookings. Deleting will:
• Remove it from your storefront
• Keep existing booking records intact
• This action cannot be undone

[Cancel]  [Delete Product]
```
