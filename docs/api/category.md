# API Design: Category Module

## Guest Endpoints

---

### GET `/api/v1/categories`

List all active categories with subcategories.

**Auth**: None

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Saree",
      "slug": "saree",
      "icon": "saree-icon",
      "productCount": 24,
      "subcategories": [
        { "id": "...", "name": "Banarasi", "slug": "banarasi", "productCount": 8 },
        { "id": "...", "name": "Jamdani", "slug": "jamdani", "productCount": 6 }
      ]
    }
  ]
}
```

Only returns `is_active = true`. Ordered by `display_order`.

---

### GET `/api/v1/events`

List all active events.

**Auth**: None

**Response** `200`:
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "Wedding", "slug": "wedding", "productCount": 35 },
    { "id": "...", "name": "Holud", "slug": "holud", "productCount": 20 }
  ]
}
```

---

## Owner Endpoints

---

### POST `/api/v1/owner/categories`

Create a category.

**Auth**: Bearer token — Owner only

**Request Body**:
```json
{
  "name": "Lehenga",
  "icon": "lehenga-icon",
  "displayOrder": 2
}
```

Slug auto-generated from name.

**Response** `201`: Created category

---

### PATCH `/api/v1/owner/categories/:id`

Update category (name, icon, order, active status).

---

### DELETE `/api/v1/owner/categories/:id`

Delete category. Fails if products exist in category.

**Error**: `422 UNPROCESSABLE` — "Category has 15 products. Move or delete them first."

---

### POST `/api/v1/owner/categories/:id/subcategories`

Create subcategory under a category.

**Request Body**:
```json
{
  "name": "Banarasi",
  "displayOrder": 0
}
```

---

### PATCH `/api/v1/owner/subcategories/:id`

Update subcategory.

---

### DELETE `/api/v1/owner/subcategories/:id`

Delete subcategory.

---

### POST `/api/v1/owner/events`

Create an event.

**Request Body**:
```json
{
  "name": "Eid",
  "displayOrder": 5
}
```

---

### PATCH `/api/v1/owner/events/:id`

Update event.

---

### DELETE `/api/v1/owner/events/:id`

Delete event. Removes product-event associations.
