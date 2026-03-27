# API Design: Inventory / Availability Module

## Guest Endpoints

---

### GET `/api/v1/products/:id/availability`

Check product availability for a date range.

**Auth**: None

**Query Params**:
| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | date (YYYY-MM-DD) | Yes | Desired start |
| `endDate` | date (YYYY-MM-DD) | Yes | Desired end |

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "productId": "...",
    "available": true,
    "requestedRange": { "start": "2026-04-15", "end": "2026-04-17" },
    "conflicts": []
  }
}
```

If unavailable:
```json
{
  "data": {
    "productId": "...",
    "available": false,
    "requestedRange": { "start": "2026-04-15", "end": "2026-04-17" },
    "conflicts": [
      { "start": "2026-04-14", "end": "2026-04-18", "type": "booking" }
    ]
  }
}
```

---

### GET `/api/v1/products/:id/calendar`

Get availability calendar for a product (current month + next 2 months).

**Auth**: None

**Query Params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `months` | int | 3 | Number of months to return |

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "productId": "...",
    "calendar": [
      { "date": "2026-04-15", "status": "available" },
      { "date": "2026-04-16", "status": "booked" },
      { "date": "2026-04-17", "status": "booked" },
      { "date": "2026-04-18", "status": "pending" },
      { "date": "2026-04-19", "status": "blocked" }
    ]
  }
}
```

Status values: `available`, `booked`, `pending`, `blocked`

---

## Owner Endpoints

---

### POST `/api/v1/owner/products/:id/block-dates`

Manually block dates for a product.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "startDate": "2026-05-01",
  "endDate": "2026-05-05",
  "reason": "Maintenance / dry cleaning"
}
```

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "startDate": "2026-05-01",
    "endDate": "2026-05-05",
    "blockType": "manual",
    "reason": "Maintenance / dry cleaning"
  }
}
```

**Errors**:
- `409 CONFLICT` — Dates overlap with existing booking

---

### DELETE `/api/v1/owner/products/:id/block-dates/:blockId`

Remove a manual date block.

**Auth**: Bearer token — Owner, Manager

**Response** `200`: Block removed

---

### GET `/api/v1/owner/products/:id/blocks`

List all date blocks for a product.

**Auth**: Bearer token — Owner, Manager, Staff

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "startDate": "2026-04-15",
      "endDate": "2026-04-18",
      "blockType": "booking",
      "bookingId": "...",
      "bookingNumber": "#ORD-2026-0045"
    },
    {
      "id": "...",
      "startDate": "2026-05-01",
      "endDate": "2026-05-05",
      "blockType": "manual",
      "reason": "Maintenance"
    }
  ]
}
```
