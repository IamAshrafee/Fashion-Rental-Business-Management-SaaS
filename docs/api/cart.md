# API Design: Cart Module

## Overview

The cart is stored in **browser localStorage** (no backend storage). However, the API provides validation and price calculation endpoints to ensure cart data is valid before checkout.

---

## Guest Endpoints

---

### POST `/api/v1/cart/validate`

Validate cart items and recalculate prices.

**Auth**: None

Called before proceeding to checkout. Ensures all products are still available and prices are current.

**Request Body**:
```json
{
  "items": [
    {
      "productId": "...",
      "variantId": "...",
      "startDate": "2026-04-15",
      "endDate": "2026-04-17",
      "selectedSize": "M",
      "backupSize": "L",
      "tryOn": false
    },
    {
      "productId": "...",
      "variantId": "...",
      "startDate": "2026-04-20",
      "endDate": "2026-04-22",
      "selectedSize": null,
      "backupSize": null,
      "tryOn": true
    }
  ]
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "items": [
      {
        "productId": "...",
        "productName": "Royal Banarasi Saree",
        "variantName": "Ivory Gold",
        "colorName": "White",
        "featuredImageUrl": "...",
        "available": true,
        "rentalDays": 3,
        "baseRental": 7500,
        "extendedDays": 0,
        "extendedCost": 0,
        "depositAmount": 5000,
        "cleaningFee": 500,
        "backupSizeFee": 300,
        "tryOnFee": 0,
        "itemTotal": 13300,
        "shippingFee": 150
      },
      {
        "productId": "...",
        "productName": "Evening Gown",
        "available": true,
        "rentalDays": 3,
        "baseRental": 5000,
        "extendedDays": 0,
        "extendedCost": 0,
        "depositAmount": 3000,
        "cleaningFee": 300,
        "backupSizeFee": 0,
        "tryOnFee": 800,
        "itemTotal": 9100,
        "shippingFee": 150
      }
    ],
    "summary": {
      "subtotal": 12500,
      "totalFees": 1900,
      "totalShipping": 300,
      "totalDeposit": 8000,
      "grandTotal": 22700,
      "itemCount": 2
    },
    "warnings": []
  }
}
```

If any item is unavailable:
```json
{
  "data": {
    "valid": false,
    "items": [
      {
        "productId": "...",
        "available": false,
        "unavailableReason": "Product is booked for these dates"
      }
    ],
    "warnings": [
      "Royal Banarasi Saree is no longer available for April 15-17"
    ]
  }
}
```

---

### POST `/api/v1/cart/check-availability`

Quick availability check for a single product (used when adding to cart).

**Auth**: None

**Request Body**:
```json
{
  "productId": "...",
  "startDate": "2026-04-15",
  "endDate": "2026-04-17"
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "available": true,
    "rentalDays": 3,
    "estimatedPrice": 7500
  }
}
```
