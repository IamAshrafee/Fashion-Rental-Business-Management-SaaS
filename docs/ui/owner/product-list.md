# UI Spec: Product List

## Overview

Owner's inventory view. Searchable, filterable table/grid of all products.

**Route**: `/dashboard/products`

---

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Products (85)                               [+ Add Product]    │
├────────────────────────────────────────────────────────────────┤
│ [Search products...________]  Status: [All ▾]  Category: [▾]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌─────┬────────────────┬──────────┬────────┬────────┬───────┐ │
│ │ Img │ Name           │ Price    │ Status │ Booked │ Rev   │ │
│ ├─────┼────────────────┼──────────┼────────┼────────┼───────┤ │
│ │[img]│Royal Banarasi  │ ৳7,500   │🟢 Pub  │  12    │৳90K   │ │
│ │     │Saree · White   │ /3 days  │        │        │       │ │
│ ├─────┼────────────────┼──────────┼────────┼────────┼───────┤ │
│ │[img]│Evening Gown    │ ৳5,000   │🟢 Pub  │   8    │৳40K   │ │
│ │     │Red             │ /3 days  │        │        │       │ │
│ ├─────┼────────────────┼──────────┼────────┼────────┼───────┤ │
│ │[img]│Sherwani Set    │ ৳12,000  │⚪ Draft │   0    │  ৳0   │ │
│ │     │Black           │ /5 days  │        │        │       │ │
│ └─────┴────────────────┴──────────┴────────┴────────┴───────┘ │
│                                                                │
│ [← 1 2 3 4 5 →]                          Showing 1-20 of 85   │
└────────────────────────────────────────────────────────────────┘
```

---

## Row Actions

Click a row → navigate to edit page. Or hover to reveal action icons:

| Action | Icon | Description |
|---|---|---|
| Edit | ✏️ | Open edit page |
| Preview | 👁 | Open storefront product page |
| Duplicate | 📋 | Clone product as draft |
| Quick Status | ● | Toggle published/draft |

---

## Status Badges

| Status | Badge |
|---|---|
| Published | 🟢 green pill |
| Draft | ⚪ gray pill |
| Archived | ⚫ dark pill |
| Unavailable | 🔴 red pill |

---

## Mobile Layout

Cards instead of table rows:

```
┌──────────────────────────────────────┐
│ [Img]  Royal Banarasi Saree         │
│        ৳7,500 / 3 days  · 🟢 Pub   │
│        12 bookings · ৳90,000 rev    │
│        [Edit] [Preview]              │
└──────────────────────────────────────┘
```
