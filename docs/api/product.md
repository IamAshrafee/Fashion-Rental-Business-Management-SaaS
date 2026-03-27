# API Design: Product Module

## Guest Endpoints (No Auth)

---

### GET `/api/v1/products`

List published products for storefront.

**Auth**: None

**Query Params**: See [search.md](./search.md) for full filter params.

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | asc/desc |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Royal Banarasi Saree",
      "slug": "royal-banarasi-saree",
      "category": { "id": "...", "name": "Saree", "slug": "saree" },
      "subcategory": { "id": "...", "name": "Banarasi", "slug": "banarasi" },
      "events": [{ "id": "...", "name": "Wedding" }],
      "rentalPrice": 7500,
      "pricingMode": "one_time",
      "includedDays": 3,
      "depositAmount": 5000,
      "isAvailable": true,
      "totalBookings": 12,
      "defaultVariant": {
        "id": "...",
        "mainColor": { "name": "White", "hexCode": "#FFFFFF" },
        "featuredImage": { "url": "...", "thumbnailUrl": "..." }
      },
      "variantCount": 3
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 85, "pages": 5 }
}
```

Only returns `status = published` and `is_available = true` products. `deleted_at IS NULL`.

---

### GET `/api/v1/products/:slug`

Get full product detail by slug.

**Auth**: None

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Royal Banarasi Saree",
    "slug": "royal-banarasi-saree",
    "description": "<p>Exquisite Banarasi silk...</p>",
    "category": { "id": "...", "name": "Saree" },
    "subcategory": { "id": "...", "name": "Banarasi" },
    "events": [{ "id": "...", "name": "Wedding" }, { "id": "...", "name": "Reception" }],
    "pricing": {
      "mode": "one_time",
      "rentalPrice": 7500,
      "includedDays": 3,
      "extendedRentalRate": 500,
      "shippingMode": "flat",
      "shippingFee": 150
    },
    "size": {
      "mode": "measurement",
      "measurements": [
        { "label": "Chest", "value": "38", "unit": "inch" },
        { "label": "Length", "value": "42", "unit": "inch" }
      ]
    },
    "services": {
      "depositAmount": 5000,
      "cleaningFee": 500,
      "backupSizeEnabled": true,
      "backupSizeFee": 300,
      "tryOnEnabled": true,
      "tryOnFee": 1000
    },
    "variants": [
      {
        "id": "...",
        "variantName": "Ivory Gold",
        "mainColor": { "id": "...", "name": "White", "hexCode": "#FFFFFF" },
        "identicalColors": [{ "name": "Ivory", "hexCode": "#FFFFF0" }],
        "images": [
          { "id": "...", "url": "...", "thumbnailUrl": "...", "isFeatured": true, "sequence": 0 },
          { "id": "...", "url": "...", "thumbnailUrl": "...", "isFeatured": false, "sequence": 1 }
        ]
      }
    ],
    "faqs": [
      { "id": "...", "question": "Is this dry-clean only?", "answer": "Yes..." }
    ],
    "details": [
      {
        "header": "Fabric Details",
        "entries": [
          { "key": "Material", "value": "Banarasi Silk" },
          { "key": "Weight", "value": "Heavy" }
        ]
      }
    ],
    "totalBookings": 12,
    "purchasePrice": null,
    "itemCountry": null
  }
}
```

`purchasePrice` and `itemCountry` only included if their `_public` flag is true.

---

## Owner Endpoints (Auth Required)

---

### GET `/api/v1/owner/products`

List all products (including drafts, archived) for the owner dashboard.

**Auth**: Bearer token — Owner, Manager

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `status` | string | `draft`, `published`, `archived` |
| `category` | UUID | Filter by category |
| `search` | string | Search by name |

**Response** `200`: Same structure as guest list but includes:
- `status` field visible
- `purchasePrice` always included
- `minInternalPrice` included
- Draft and archived products included

---

### POST `/api/v1/owner/products`

Create a new product.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "name": "Royal Banarasi Saree",
  "description": "...",
  "categoryId": "...",
  "subcategoryId": "...",
  "eventIds": ["...", "..."],
  "status": "draft",
  "purchaseDate": "2026-01-15",
  "purchasePrice": 15000,
  "purchasePricePublic": false,
  "itemCountry": "India",
  "itemCountryPublic": true,
  "targetRentals": 5,
  "pricing": {
    "mode": "one_time",
    "rentalPrice": 7500,
    "includedDays": 3,
    "extendedRentalRate": 500,
    "minInternalPrice": 5000,
    "lateFeeType": "fixed",
    "lateFeeAmount": 300,
    "maxLateFee": 2000,
    "shippingMode": "flat",
    "shippingFee": 150
  },
  "size": {
    "mode": "measurement",
    "measurements": [
      { "label": "Chest", "value": "38", "unit": "inch" }
    ]
  },
  "services": {
    "depositAmount": 5000,
    "cleaningFee": 500,
    "backupSizeEnabled": true,
    "backupSizeFee": 300,
    "tryOnEnabled": true,
    "tryOnFee": 1000
  },
  "faqs": [
    { "question": "Is this dry-clean only?", "answer": "Yes..." }
  ],
  "details": [
    {
      "header": "Fabric Details",
      "entries": [
        { "key": "Material", "value": "Banarasi Silk" }
      ]
    }
  ]
}
```

Variants and images are added separately via dedicated endpoints after product creation.

**Response** `201`: Created product object

---

### PATCH `/api/v1/owner/products/:id`

Update a product. Same structure as POST, all fields optional.

**Auth**: Bearer token — Owner, Manager

**Response** `200`: Updated product object

---

### DELETE `/api/v1/owner/products/:id`

Soft-delete a product.

**Auth**: Bearer token — Owner only

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Product deleted" }
}
```

---

### PATCH `/api/v1/owner/products/:id/status`

Quick status update.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "status": "published"
}
```

**Response** `200`: Updated product

---

## Variant Endpoints

### POST `/api/v1/owner/products/:id/variants`

Add a variant to a product.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "variantName": "Ivory Gold",
  "mainColorId": "...",
  "identicalColorIds": ["...", "..."],
  "sequence": 0
}
```

**Response** `201`: Created variant

### PATCH `/api/v1/owner/products/:productId/variants/:variantId`

Update a variant.

### DELETE `/api/v1/owner/products/:productId/variants/:variantId`

Delete a variant and its images.
