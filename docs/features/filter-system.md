# Feature Spec: Filter System

## Overview

Filters help guests narrow down products by specific attributes. The filter system has two layers: quick filter pills for common selections and an advanced filter drawer for detailed filtering.

---

## Quick Filter Pills

Horizontal scrollable row of pill-shaped buttons below the search bar.

### Default Pills (Order)

```
[All] [Wedding] [Holud] [Reception] [Bridal] [Sherwani] [Saree] [Under ৳5,000] [Available This Week]
```

### Pill Sources

| Pill | Source | Filter Applied |
|---|---|---|
| Event pills | Tenant's active events | `?event=wedding` |
| Category pills | Tenant's popular categories | `?category=saree` |
| Price pills | System-defined | `?maxPrice=5000` |
| Availability pills | System-defined | `?availableFrom=today&availableTo=+7days` |

### Behavior
- Tapping a pill applies the filter and refreshes results
- Active pill is visually highlighted (filled/colored)
- Multiple pills can be active simultaneously (AND logic)
- Tapping an active pill deactivates it
- "All" clears all pill filters

### Owner Customization
Owner can configure which pills appear and in what order (from Store Settings). System provides reasonable defaults based on the tenant's categories and events.

---

## Advanced Filter Drawer

Triggered by tapping the filter icon button. Slides up as a bottom sheet (mobile) or side drawer (desktop).

### Filter Options

#### Category
- Dropdown or selectable list
- Single select
- Shows product count per category: "Saree (24)"

#### Subcategory
- Dependent on selected category
- Single select
- Only appears if a category is selected

#### Event
- Multi-select checkboxes
- Show product count per event

#### Color
- Color swatches (visual circles)
- Multi-select
- Searches across both main and identical colors
- **Key feature**: When a color is selected, product cards update thumbnails to show matching variant images

#### Size
- Checkboxes for standard sizes: XS, S, M, L, XL, XXL
- Selecting a size filters products that have that size available

#### Price Range
- Slider with min/max
- Currency: ৳
- Preset buttons: Under ৳2,000 / ৳2,000-5,000 / ৳5,000-10,000 / ৳10,000+
- Custom range input fields

#### Availability
- Date picker: "Available for these dates"
- Select start and end date
- Filters products that are not booked during selected range
- This is a powerful feature — guest can immediately see what's available for their event date

#### Rental Duration
- Quick options: 1 day / 3 days / 5 days / 7 days / Custom
- Filters to products that support the selected duration

### Sort Options (Inside Filter Drawer)

| Option | Logic |
|---|---|
| Relevance (default) | System-determined: popularity + recency |
| Price: Low to High | By rental price ascending |
| Price: High to Low | By rental price descending |
| Most Popular | By booking count descending |
| Newly Added | By creation date descending |

### Filter Drawer Actions

```
[Reset All]                  [Apply Filters (24 results)]
```

- "Reset All" clears all filter selections
- "Apply" button shows result count before applying
- Result count updates in real-time as user changes filters

---

## URL-Based Filtering

All active filters are reflected in the URL:

```
/products?category=saree&event=wedding&color=red&minPrice=3000&maxPrice=10000&sort=price_asc
```

### Why URL-Based?

1. **Shareable**: Owner can share a filtered link on Facebook: "Check out our wedding sarees!"
2. **SEO**: Search engines can index category/event pages
3. **Back button**: Browser back returns to previous filter state
4. **Bookmarkable**: Customers can bookmark a filtered view

---

## Filter + Search Interaction

- Search and filters work together (AND logic)
- Searching "silk" with filter "Category: Saree" → shows silk sarees only
- Clearing search does not clear filters, and vice versa
- Both are reflected in URL

---

## Smart Thumbnail Update (On Color Filter)

When a color filter is applied:

1. For each product in results, check which variant matches the filtered color
2. Use the matching variant's featured image as the product card thumbnail
3. If multiple variants match, use the first matching variant

**Example**:
- Filter: Color = Red
- Product "Royal Saree" has variants: White (main), Blue (main, identical: Red)
- Card shows Blue variant's featured image (because Blue variant has Red as identical)

This is the same behavior described in [color-variant-system.md](./color-variant-system.md).

---

## Empty State

When filters return no results:

```
No products match your filters

Try:
• Removing some filters
• Selecting a different category
• Changing your date range

[Clear All Filters]
```

---

## Filter API

```
GET /api/products?category=saree&event=wedding&color=red&minPrice=3000&maxPrice=10000&size=M&availableFrom=2026-04-15&availableTo=2026-04-17&sort=price_asc&page=1&limit=20

Response:
{
  "products": [...],
  "total": 24,
  "page": 1,
  "pages": 2,
  "appliedFilters": {
    "category": "saree",
    "event": "wedding",
    "color": "red",
    "minPrice": 3000,
    "maxPrice": 10000,
    "size": "M"
  },
  "availableFilters": {
    "categories": [{ "name": "Saree", "slug": "saree", "count": 24 }],
    "events": [{ "name": "Wedding", "slug": "wedding", "count": 18 }],
    "colors": [{ "name": "Red", "hex": "#E53935", "count": 8 }],
    "sizes": [{ "name": "M", "count": 12 }],
    "priceRange": { "min": 1500, "max": 25000 }
  }
}
```

The `availableFilters` response tells the frontend what filter options to show with their counts — this prevents showing filters that have 0 results.

---

## Business Rules Summary

1. Filters are tenant-scoped
2. Only published and available products appear
3. Quick pills and advanced filters work together
4. Color filter triggers smart thumbnail switching
5. All filters reflected in URL for shareability and SEO
6. Filter API returns available filter counts to prevent dead-end selections
7. Availability date filter checks against real booking data
8. Sort and filter are independent — both can be active
