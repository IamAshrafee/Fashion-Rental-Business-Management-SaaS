# UI Spec: Product Details Page

## Overview

The full product view. This page must be high-conversion — the guest decides whether to book here.

**Route**: `/products/:slug`

---

## Mobile Layout

```
┌────────────────────────────────────────────┐
│ ← Back                         🛒(2)       │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │                                      │   │
│ │         [Main Image]                 │   │ ← Swipeable gallery
│ │                                      │   │
│ └──────────────────────────────────────┘   │
│  ● ○ ○ ○ ○  (image dots)                  │
│                                            │
│  [thumb1] [thumb2] [thumb3] [thumb4]       │ ← Scrollable thumbnails
├────────────────────────────────────────────┤
│  Royal Banarasi Saree                      │ ← H1
│  Saree › Banarasi                          │ ← Category breadcrumb
│  Wedding · Reception                       │ ← Event badges
│                                            │
│  ৳7,500 / 3 days included                 │ ← Price (large, brand color)
│  Extended: ৳500/extra day                  │
│  Deposit: ৳5,000 (refundable)             │
├────────────────────────────────────────────┤
│  Color Variants                            │
│  [⚪ White] [🔵 Blue] [🔴 Red]             │ ← Tappable, switches images
│  Selected: White — "Ivory Gold"            │
├────────────────────────────────────────────┤
│  Size Info                                 │
│  ┌────────────────────────────────────┐   │
│  │ Chest: 38 inch                     │   │
│  │ Waist: 32 inch                     │   │
│  │ Length: 42 inch                    │   │
│  └────────────────────────────────────┘   │
│  [View Size Chart]                         │
├────────────────────────────────────────────┤
│  Select Rental Dates                       │
│  [Start Date] → [End Date]                 │ ← Calendar picker
│  3 days · ৳7,500                           │
│                                            │
│  ☐ Try before renting (৳1,000)             │
│  ☐ Add backup size (৳300, Size: [L ▾])     │
├────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐   │
│  │  Availability: ✅ Available         │   │ ← Calendar mini-view
│  │  [April availability calendar]      │   │
│  └────────────────────────────────────┘   │
├────────────────────────────────────────────┤
│  Description                               │
│  Exquisite Banarasi silk saree...          │
│  [Read more]                               │
├────────────────────────────────────────────┤
│  Product Details                           │
│  ▸ Fabric Details                          │ ← Accordion
│    Material: Banarasi Silk                 │
│    Weight: Heavy                           │
│  ▸ Care Instructions                      │
│    Dry clean only                          │
├────────────────────────────────────────────┤
│  FAQ                                       │
│  ▸ Is alteration possible?                │ ← Accordion
│  ▸ What if I return late?                 │
├────────────────────────────────────────────┤
│  Booked 12 times this month               │ ← Social proof
├────────────────────────────────────────────┤
│                                            │
│  ┌────────────────────────────────────┐   │
│  │ [Add to Cart — ৳13,300]           │   │ ← Sticky bottom CTA
│  └────────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

---

## Desktop Layout

Two-column layout:

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to Products                                    🛒(2)      │
├──────────────────────────────┬───────────────────────────────────┤
│                              │                                   │
│  ┌────────────────────────┐  │  Royal Banarasi Saree             │
│  │                        │  │  Saree › Banarasi                 │
│  │     [Main Image]       │  │  [Wedding] [Reception]            │
│  │                        │  │                                   │
│  └────────────────────────┘  │  ৳7,500 / 3 days included        │
│                              │  Extended: ৳500/day               │
│  [t1] [t2] [t3] [t4] [t5]   │  Deposit: ৳5,000                  │
│                              │                                   │
│                              │  Color: [⚪] [🔵] [🔴]            │
│                              │  Selected: White — Ivory Gold     │
│                              │                                   │
│                              │  Size: Chest 38" · Waist 32"     │
│                              │  [Size Chart]                     │
│                              │                                   │
│                              │  Rental Dates                     │
│                              │  [Apr 15] → [Apr 17] = 3 days    │
│                              │                                   │
│                              │  ☐ Try before rent (৳1,000)       │
│                              │  ☐ Backup size (৳300)             │
│                              │                                   │
│                              │  ✅ Available for selected dates   │
│                              │                                   │
│                              │  [Add to Cart — ৳13,300]          │
│                              │                                   │
├──────────────────────────────┴───────────────────────────────────┤
│  Description | Details | FAQ | Availability Calendar             │
│  ─────────────────────────────────────────────────              │
│  [Tab content]                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Image Gallery Behavior

1. **Main image**: Large view, swipeable on mobile
2. **Thumbnails**: Scrollable row below main image
3. **Click thumbnail**: Switches main image
4. **Pinch-to-zoom**: On mobile
5. **Click main image (desktop)**: Opens full-screen lightbox with prev/next arrows
6. **Variant switch**: Replaces entire image set with selected variant's images

---

## Price Breakdown (Dynamic)

As user selects options, the price updates in real-time:

```
Price Summary
─────────────────────
Rental (3 days):      ৳7,500
Cleaning fee:           ৳500
Backup size (L):        ৳300
Deposit (refundable):  ৳5,000
─────────────────────
Total:               ৳13,300
```

---

## Availability Calendar

Mini calendar showing availability at a glance:

- 🟢 Green dot: Available
- 🔴 Red dot: Booked
- 🟡 Yellow dot: Pending
- ⬛ Gray dot: Manually blocked

---

## Sticky Bottom CTA (Mobile)

Always visible at the bottom of the screen:

```
┌────────────────────────────────────────────┐
│  ৳13,300          [Add to Cart]            │
└────────────────────────────────────────────┘
```

Price updates as options change. Button disabled if dates not selected or product unavailable.
