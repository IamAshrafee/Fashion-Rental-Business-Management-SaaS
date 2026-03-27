# API Design: Upload Module

## Owner Endpoints

---

### POST `/api/v1/owner/upload/product-image`

Upload product variant images.

**Auth**: Bearer token — Owner, Manager

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | Image file |
| `variantId` | string | Yes | Target variant |
| `isFeatured` | boolean | No | Set as featured (default false) |

**Validation**:
- Max file size: 10 MB
- Allowed types: JPEG, PNG, WebP
- Max dimensions: 4000×4000

**Processing**:
1. Validate file type and size
2. Convert to WebP format
3. Generate optimized full-size image (max 1200px width)
4. Generate thumbnail (400×400)
5. Upload both to MinIO at `/tenant-{id}/products/{productId}/{variantId}/`
6. Create `product_images` record

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "url": "https://cdn.closetrent.com/...",
    "thumbnailUrl": "https://cdn.closetrent.com/...",
    "isFeatured": false,
    "sequence": 2,
    "fileSize": 245000
  }
}
```

---

### POST `/api/v1/owner/upload/product-images`

Bulk upload (up to 10 images at once).

**Auth**: Bearer token — Owner, Manager

**Request**: `multipart/form-data` with multiple `files[]`

**Response** `201`: Array of created image objects

---

### DELETE `/api/v1/owner/upload/product-image/:imageId`

Delete a product image.

**Auth**: Bearer token — Owner, Manager

Deletes from MinIO and database. If deleted image was featured, the next image in sequence becomes featured.

---

### PATCH `/api/v1/owner/upload/product-images/reorder`

Reorder images within a variant.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "variantId": "...",
  "imageIds": ["id-3", "id-1", "id-2"]
}
```

Sets sequence based on array position.

---

### POST `/api/v1/owner/upload/logo`

Upload store logo.

**Auth**: Bearer token — Owner

**Request**: `multipart/form-data`

**Validation**: Max 5 MB, JPEG/PNG/WebP/SVG

**Response** `200`:
```json
{
  "success": true,
  "data": { "logoUrl": "https://..." }
}
```

---

### POST `/api/v1/owner/upload/banners`

Upload storefront banner.

**Auth**: Bearer token — Owner

**Request**: `multipart/form-data`

**Validation**: Max 10 MB, recommended 1920×600

**Response** `201`: Banner object with URL and sequence

---

### POST `/api/v1/owner/upload/damage-photo`

Upload damage assessment photo.

**Auth**: Bearer token — Owner, Manager

**Request**: `multipart/form-data`

**Response** `201`: Photo URL
