# API Design: Search & Filter Module

## Guest Endpoints

---

### GET `/api/v1/products/search`

Full-text search across products.

**Auth**: None

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (required) |
| `page` | int | Page number |
| `limit` | int | Items per page |

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "results": [ ...product cards ],
    "total": 12,
    "query": "red wedding saree"
  },
  "meta": { "page": 1, "limit": 20, "pages": 1 }
}
```

Product cards include smart thumbnail — if query matches a color, show matching variant image.

---

### GET `/api/v1/products`

Filtered product listing (same endpoint as product list, with filter params).

**Auth**: None

**Full Filter Params**:
| Param | Type | Description |
|---|---|---|
| `category` | string (slug) | Filter by category |
| `subcategory` | string (slug) | Filter by subcategory |
| `event` | string (slug) | Filter by event (multi: `event=wedding&event=holud`) |
| `color` | string | Filter by color name (multi: `color=red&color=blue`) |
| `size` | string | Filter by available size |
| `minPrice` | number | Minimum rental price |
| `maxPrice` | number | Maximum rental price |
| `availableFrom` | date | Available starting from |
| `availableTo` | date | Available until |
| `sort` | string | Sort field |
| `order` | string | asc/desc |
| `page` | int | Page number |
| `limit` | int | Items per page |

**Sort Options**:
| Value | Description |
|---|---|
| `relevance` | System-determined (default) |
| `price_asc` | Price low to high |
| `price_desc` | Price high to low |
| `popularity` | Most booked |
| `newest` | Recently added |

**Response** `200`:
```json
{
  "success": true,
  "data": [ ...product cards with smart thumbnails ],
  "meta": { "page": 1, "limit": 20, "total": 24, "pages": 2 },
  "filters": {
    "categories": [
      { "slug": "saree", "name": "Saree", "count": 24 }
    ],
    "events": [
      { "slug": "wedding", "name": "Wedding", "count": 18 }
    ],
    "colors": [
      { "name": "Red", "hexCode": "#E53935", "count": 8 }
    ],
    "sizes": [
      { "name": "M", "count": 12 }
    ],
    "priceRange": { "min": 1500, "max": 25000 }
  }
}
```

The `filters` object returns available filter options with counts, enabling the frontend to show only relevant filter choices and hide zero-result options.

---

### GET `/api/v1/products/search/suggest`

Auto-suggest as user types (debounced).

**Auth**: None

**Query Params**: `?q=bar` (min 3 characters)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      { "type": "product", "text": "Banarasi Saree", "slug": "banarasi-saree" },
      { "type": "category", "text": "Banarasi", "slug": "saree?subcategory=banarasi" }
    ]
  }
}
```
