# UI Spec: Shopping Page

## Overview

The main product browsing page. Guests land here from the homepage or via category/event links. Displays a filterable, sortable grid of product cards.

**Route**: `/` or `/products` or `/products?category=saree&event=wedding`

---

## Page Layout

### Mobile

```
┌────────────────────────────────────────────┐
│ [Sticky Header with search]               │
├────────────────────────────────────────────┤
│ [Banner Carousel] (if on homepage)         │
├────────────────────────────────────────────┤
│ [Quick Filter Pills — scrollable]          │
│ [All] [Wedding] [Saree] [Under ৳5K] [🔧]  │
├────────────────────────────────────────────┤
│ Showing 85 products          [Sort ▾]      │
├────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐                  │
│ │ [Image]  │ │ [Image]  │                  │
│ │ Name     │ │ Name     │                  │
│ │ ৳7,500   │ │ ৳5,000   │                  │
│ │ ● ● ● ●  │ │ ● ●      │                  │
│ └──────────┘ └──────────┘                  │
│ ┌──────────┐ ┌──────────┐                  │
│ │ [Image]  │ │ [Image]  │                  │
│ │ Name     │ │ Name     │                  │
│ │ ৳12,000  │ │ ৳3,500   │                  │
│ │ ● ●      │ │ ● ● ● ●  │                  │
│ └──────────┘ └──────────┘                  │
├────────────────────────────────────────────┤
│      [Load More] or infinite scroll        │
└────────────────────────────────────────────┘
```

### Desktop

```
┌─────────────────────────────────────────────────────────────┐
│ [Sticky Header]                                              │
├───────────┬─────────────────────────────────────────────────┤
│           │ [Quick Filter Pills]  [All] [Wedding] ...  [🔧]│
│  Advanced │ Showing 85 products            [Sort: Popular ▾]│
│  Filter   ├─────────────────────────────────────────────────┤
│  Sidebar  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│           │ │[Image] │ │[Image] │ │[Image] │ │[Image] │   │
│  Category │ │ Name   │ │ Name   │ │ Name   │ │ Name   │   │
│  Event    │ │ ৳7,500 │ │ ৳5,000 │ │ ৳12K   │ │ ৳3,500 │   │
│  Color    │ │ ● ● ●  │ │ ● ●    │ │ ● ● ●  │ │ ● ●    │   │
│  Size     │ └────────┘ └────────┘ └────────┘ └────────┘   │
│  Price    │                                                 │
│  Date     │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│           │ │ ...    │ │ ...    │ │ ...    │ │ ...    │   │
│ [Reset]   │ └────────┘ └────────┘ └────────┘ └────────┘   │
└───────────┴─────────────────────────────────────────────────┘
```

On desktop, the advanced filter panel is a persistent sidebar (collapsible).

---

## Product Card

```
┌──────────────────────┐
│ ┌──────────────────┐ │
│ │                  │ │ ← Product image (1:1 aspect ratio)
│ │    [Image]       │ │   Shows variant's featured image
│ │                  │ │
│ └──────────────────┘ │
│                      │
│  Royal Banarasi Saree│ ← Product name (1-2 lines, truncated)
│  Saree · Wedding     │ ← Category · Event (muted text)
│                      │
│  ৳7,500 / 3 days     │ ← Price + duration (brand color, bold)
│                      │
│  ⚪ 🔴 🔵 🟢          │ ← Color dots (variant colors)
│                      │
│  ✅ Available         │ ← or "Booked" in red
└──────────────────────┘
```

### Card Interactions

- **Hover**: Slight scale-up (1.02) + shadow elevation
- **Click anywhere**: Navigate to product detail page
- **Color dot hover**: Shows color name tooltip
- **Color dot click**: Switches card thumbnail to that variant's featured image (smart thumbnail)

### Card Responsive Sizing

| Screen | Columns | Card Width |
|---|---|---|
| Mobile (< 768px) | 2 | ~48% |
| Tablet (768-1023px) | 3 | ~32% |
| Desktop (≥ 1024px) | 4 | ~24% |

---

## Banner Carousel (Homepage Only)

- Full-width image carousel at the top
- 3-5 banners, auto-rotates every 5 seconds
- Manual swipe/arrow navigation
- Dots indicator at bottom
- Only shows on homepage, not on filtered views

---

## Filter Drawer (Mobile)

Triggered by the 🔧 filter icon. Slides up as a bottom sheet.

```
┌────────────────────────────────────────────┐
│ Filters                           ✕ Close  │
├────────────────────────────────────────────┤
│ Category                             [▾]   │
│ ┌─────────────────────────────────────┐    │
│ │ Saree (24)  Lehenga (18)  Gown (8) │    │
│ └─────────────────────────────────────┘    │
│                                            │
│ Event                                      │
│ ☑ Wedding (35)  ☐ Holud (20)              │
│ ☐ Reception (15)  ☐ Eid (10)              │
│                                            │
│ Color                                      │
│ [⚪] [🔴] [🔵] [🟢] [⚫] [🟡]              │
│                                            │
│ Size                                       │
│ [XS] [S] [M] [L] [XL] [XXL]              │
│                                            │
│ Price Range                                │
│ ৳ [1,000] ————●————— ৳ [25,000]           │
│ [Under ৳2K] [৳2K-5K] [৳5K-10K] [৳10K+]   │
│                                            │
│ Available Dates                            │
│ [April 15] → [April 17]                   │
│                                            │
│ Sort By                                    │
│ ○ Relevance  ○ Price ↑  ○ Price ↓         │
│ ○ Most Popular  ○ Newest                   │
├────────────────────────────────────────────┤
│ [Reset All]           [Apply (24 results)] │
└────────────────────────────────────────────┘
```

---

## Empty / No Results

```
┌────────────────────────────────────────────┐
│                                            │
│      🔍                                    │
│      No products match your filters        │
│                                            │
│      Try:                                  │
│      • Removing some filters               │
│      • Selecting a different category      │
│      • Changing your date range            │
│                                            │
│      [Clear All Filters]                   │
│                                            │
└────────────────────────────────────────────┘
```

---

## Loading States

- **Initial load**: 8 skeleton cards (gray pulse rectangles)
- **Load more**: Spinner below existing cards
- **Filter change**: Cards fade out → skeleton → fade in
