# API Design: Booking Module

## Guest Endpoints

---

### POST `/api/v1/bookings`

Create a booking (called at checkout completion).

**Auth**: None (guest checkout)

**Request Body**:
```json
{
  "customer": {
    "fullName": "Fatima Rahman",
    "phone": "01712345678",
    "altPhone": "01812345678",
    "email": "fatima@email.com"
  },
  "delivery": {
    "address": "House 12, Road 5, Block C",
    "area": "Dhanmondi",
    "thana": "Dhanmondi",
    "district": "Dhaka"
  },
  "items": [
    {
      "productId": "...",
      "variantId": "...",
      "startDate": "2026-04-15",
      "endDate": "2026-04-17",
      "selectedSize": "M",
      "backupSize": "L",
      "tryOn": false
    }
  ],
  "paymentMethod": "cod",
  "bkashTransactionId": null,
  "customerNotes": "Please deliver before 10 AM"
}
```

**Server-Side Processing**:
1. Validate all product availability for requested dates
2. Recalculate all prices from current product data (never trust client prices)
3. Create/find customer by phone (dedup)
4. Create booking + booking items with price snapshots
5. Create date blocks (type: pending)
6. Generate booking number
7. Send SMS notification to owner
8. Return booking confirmation

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "bookingId": "...",
    "bookingNumber": "#ORD-2026-0045",
    "status": "pending",
    "grandTotal": 13650,
    "breakdown": {
      "subtotal": 7500,
      "cleaningFee": 500,
      "backupSizeFee": 300,
      "shippingFee": 150,
      "deposit": 5000,
      "tryOnFee": 0,
      "total": 13450
    },
    "paymentMethod": "cod",
    "deliveryAddress": "House 12, Road 5, Block C, Dhanmondi, Dhaka",
    "items": [
      {
        "productName": "Royal Banarasi Saree",
        "colorName": "White",
        "size": "M",
        "startDate": "2026-04-15",
        "endDate": "2026-04-17",
        "rentalDays": 3,
        "baseRental": 7500,
        "deposit": 5000
      }
    ]
  }
}
```

**Errors**:
- `409 CONFLICT` — Product not available for requested dates
- `422 UNPROCESSABLE` — Invalid date range, product not published

---

### GET `/api/v1/bookings/:bookingNumber/status`

Guest order tracking by booking number.

**Auth**: None (public, but requires booking number)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "bookingNumber": "#ORD-2026-0045",
    "status": "shipped",
    "trackingNumber": "PTHO-123456",
    "timeline": [
      { "status": "pending", "at": "2026-04-13T10:30:00Z" },
      { "status": "confirmed", "at": "2026-04-13T11:00:00Z" },
      { "status": "shipped", "at": "2026-04-14T09:00:00Z" }
    ]
  }
}
```

---

## Owner Endpoints

---

### GET `/api/v1/owner/bookings`

List all bookings.

**Auth**: Bearer token — Owner, Manager, Staff

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status |
| `search` | string | Search by booking number or customer name |
| `dateFrom` | date | Created after |
| `dateTo` | date | Created before |
| `paymentStatus` | string | unpaid, partial, paid |

**Response** `200`: Paginated booking list with customer info, items summary, totals

---

### GET `/api/v1/owner/bookings/:id`

Full booking detail.

**Auth**: Bearer token — Owner, Manager, Staff

**Response** `200`: Complete booking with all items, customer, payment history, timeline, damage reports

---

### PATCH `/api/v1/owner/bookings/:id/status`

Change booking status.

**Auth**: Bearer token — Owner, Manager, Staff

**Request Body**:
```json
{
  "status": "confirmed"
}
```

**Status Transition Rules**:
| From | Allowed To |
|---|---|
| pending | confirmed, cancelled |
| confirmed | shipped, cancelled |
| shipped | delivered |
| delivered | returned, overdue |
| overdue | returned |
| returned | inspected |
| inspected | completed |

**Errors**:
- `422 UNPROCESSABLE` — Invalid status transition

---

### PATCH `/api/v1/owner/bookings/:id/ship`

Ship a booking (with optional courier integration).

**Auth**: Bearer token — Owner, Manager, Staff

**Request Body**:
```json
{
  "courierProvider": "pathao",
  "trackingNumber": "PTHO-123456",
  "useCourierApi": true
}
```

If `useCourierApi = true`, the system creates a parcel via the courier API and auto-fills the tracking number.

---

### PATCH `/api/v1/owner/bookings/:id/cancel`

Cancel a booking.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "reason": "Customer requested cancellation"
}
```

Releases date blocks and updates availability.

---

### POST `/api/v1/owner/bookings/:id/notes`

Add internal notes.

**Auth**: Bearer token — Owner, Manager, Staff

**Request Body**:
```json
{
  "note": "Customer called to confirm delivery time"
}
```

---

### POST `/api/v1/owner/bookings/:id/items/:itemId/damage`

Report damage on a returned item.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "damageLevel": "moderate",
  "description": "Small tear on the pallu, approximately 3cm",
  "estimatedRepairCost": 2000,
  "deductionAmount": 2000,
  "additionalCharge": 0,
  "photos": ["base64_or_url_1", "base64_or_url_2"]
}
```

**Response** `201`: Created damage report
