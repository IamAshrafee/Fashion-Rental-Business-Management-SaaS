# API Design: Product Module

## Guest Endpoints (No Auth)

---

### GET `/api/v1/products`

List published products for storefront.

**Auth**: None

**Query Params**: See [search.md](./search.md) for full filter params.

| Param   | Type   | Default      | Description    |
| ------- | ------ | ------------ | -------------- |
| `page`  | int    | 1            | Page number    |
| `limit` | int    | 20           | Items per page |
| `sort`  | string | `created_at` | Sort field     |
| `order` | string | `desc`       | asc/desc       |

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
    "events": [
      { "id": "...", "name": "Wedding" },
      { "id": "...", "name": "Reception" }
    ],
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
    "faqs": [{ "id": "...", "question": "Is this dry-clean only?", "answer": "Yes..." }],
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
    "countryOfOrigin": "India",
    "referenceRetailValue": 45000
  }
}
```

`countryOfOrigin` and `referenceRetailValue` are included only when their explicit public-display flags are enabled. Physical-item acquisition fields are never returned by guest product endpoints.

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
- catalog `countryOfOrigin`, `referenceRetailValue`, and their visibility settings
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
  "countryOfOrigin": "India",
  "countryOfOriginPublic": true,
  "referenceRetailValue": 45000,
  "referenceRetailValuePublic": true,
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
    "measurements": [{ "label": "Chest", "value": "38", "unit": "inch" }]
  },
  "services": {
    "depositAmount": 5000,
    "cleaningFee": 500,
    "backupSizeEnabled": true,
    "backupSizeFee": 300,
    "tryOnEnabled": true,
    "tryOnFee": 1000
  },
  "faqs": [{ "question": "Is this dry-clean only?", "answer": "Yes..." }],
  "details": [
    {
      "header": "Fabric Details",
      "entries": [{ "key": "Material", "value": "Banarasi Silk" }]
    }
  ]
}
```

Product onboarding saves five authoritative sections: basics/sizing, variants/SKUs/media, details/FAQ, pricing/services, and review/publication. Physical items are registered separately through the canonical inventory batch endpoint after the SKU exists.

**Response** `201`: Created product object

---

### PATCH `/api/v1/owner/products/:id`

Update catalog content. Publication status uses the dedicated status command and is not a free-form field in the basic-information form. Structural changes are guarded when physical-item, booking, reservation, fulfilment, or movement history would be damaged.

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

## Variant and Rentable SKU Command

### PUT `/api/v1/owner/product-onboardings/:productId/skus`

Synchronize the product's complete ordered variant and rentable-SKU definition. This is the
single write path used by both product creation and editing. The command creates, updates,
reorders, and removes variants in one serializable transaction. It rejects stale revisions,
cross-tenant references, and removal of SKUs or variants with inventory or rental history.

**Auth**: Bearer token — Owner, Manager

**Request Body**:

```json
{
  "expectedRevision": 4,
  "variants": [
    {
      "id": "existing-variant-uuid-if-any",
      "clientKey": "stable-client-row-key",
      "variantName": "Ivory Gold",
      "mainColorId": "color-uuid",
      "identicalColorIds": ["color-uuid"],
      "sizes": [{ "sizeInstanceId": "size-instance-uuid" }]
    }
  ]
}
```

Send a unique `Idempotency-Key` header for every new save attempt. Retrying an interrupted
request with the same key and body safely replays the result.

**Response** `200`: Updated product onboarding state, revision, product, and readiness.
