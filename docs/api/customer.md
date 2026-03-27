# API Design: Customer Module

## Owner Endpoints

All endpoints require authentication. Customer management is owner-only.

---

### GET `/api/v1/owner/customers`

List all customers.

**Auth**: Bearer token — Owner, Manager, Staff

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `search` | string | Search by name or phone |
| `tag` | string | Filter by tag (VIP, Frequent) |
| `sort` | string | `name`, `total_bookings`, `total_spent`, `last_booking_at` |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "fullName": "Fatima Rahman",
      "phone": "01712345678",
      "email": "fatima@email.com",
      "totalBookings": 5,
      "totalSpent": 42500,
      "lastBookingAt": "2026-04-10T10:30:00Z",
      "tags": ["VIP", "Frequent"],
      "district": "Dhaka"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

---

### GET `/api/v1/owner/customers/:id`

Get customer detail with booking history.

**Auth**: Bearer token — Owner, Manager, Staff

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "fullName": "Fatima Rahman",
    "phone": "01712345678",
    "altPhone": "01812345678",
    "email": "fatima@email.com",
    "address": "House 12, Road 5, Block C",
    "area": "Dhanmondi",
    "district": "Dhaka",
    "notes": "Prefers morning delivery. VIP customer.",
    "tags": ["VIP"],
    "totalBookings": 5,
    "totalSpent": 42500,
    "bookings": [
      {
        "id": "...",
        "bookingNumber": "#ORD-2026-0045",
        "status": "completed",
        "grandTotal": 13650,
        "createdAt": "2026-04-10T10:30:00Z",
        "items": [{ "productName": "Royal Banarasi Saree", "colorName": "White" }]
      }
    ]
  }
}
```

---

### PATCH `/api/v1/owner/customers/:id`

Update customer info.

**Auth**: Bearer token — Owner, Manager

**Request Body** (all optional):
```json
{
  "fullName": "Fatima Rahman",
  "altPhone": "01812345678",
  "email": "fatima@email.com",
  "notes": "Prefers morning delivery"
}
```

---

### POST `/api/v1/owner/customers/:id/tags`

Add a tag to a customer.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "tag": "VIP"
}
```

---

### DELETE `/api/v1/owner/customers/:id/tags/:tag`

Remove a tag from a customer.

---

### GET `/api/v1/owner/customers/lookup`

Lookup customer by phone (used during checkout to auto-fill returning customer data).

**Auth**: None (called during guest checkout flow)

**Query Params**: `?phone=01712345678`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "found": true,
    "customer": {
      "fullName": "Fatima Rahman",
      "phone": "01712345678",
      "email": "fatima@email.com",
      "address": "House 12, Road 5, Block C",
      "area": "Dhanmondi",
      "district": "Dhaka"
    }
  }
}
```

Returns minimal info for auto-fill only — no booking history exposed to guests.
