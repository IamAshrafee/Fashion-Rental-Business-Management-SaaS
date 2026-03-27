# API Design: Order Module

## Overview

Since "Booking" and "Order" are the same entity (see [booking.md](./booking.md)), this module documents the **owner-side order management** endpoints that complement the booking lifecycle.

These endpoints focus on fulfillment operations: managing delivery, returns, deposit handling, and late fee tracking.

---

## Owner Endpoints

---

### GET `/api/v1/owner/orders/dashboard-summary`

Quick stats for the dashboard home.

**Auth**: Bearer token — Owner, Manager

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "today": {
      "newBookings": 3,
      "revenue": 22500,
      "activeRentals": 12,
      "overdueItems": 1
    },
    "pendingActions": {
      "pendingConfirmation": 2,
      "readyToShip": 1,
      "overdueReturns": 1,
      "pendingInspection": 3
    }
  }
}
```

---

### GET `/api/v1/owner/orders/overdue`

List all overdue orders.

**Auth**: Bearer token — Owner, Manager, Staff

**Response** `200`: List of overdue bookings with return dates, customer info, and accumulated late fees.

---

### PATCH `/api/v1/owner/bookings/:id/items/:itemId/deposit`

Update deposit status for a booking item.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "action": "refund",
  "refundAmount": 4500,
  "refundMethod": "bkash",
  "deductionReason": "Minor stain — ৳500 deducted for cleaning"
}
```

Actions: `collect`, `refund`, `partial_refund`, `forfeit`

**Response** `200`: Updated booking item with deposit status

---

### PATCH `/api/v1/owner/bookings/:id/items/:itemId/late-fee`

Record late fee for an item.

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "lateDays": 2,
  "lateFee": 600
}
```

**Response** `200`: Updated booking item

---

### GET `/api/v1/owner/orders/returns-due`

List orders with returns due today or overdue.

**Auth**: Bearer token — Owner, Manager, Staff

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `period` | string | `today`, `tomorrow`, `this_week`, `overdue` |

**Response** `200`: Filtered list of bookings needing attention
