# UI Spec: Checkout Page

## Overview

Single-page checkout. No account required. Optimized for speed and conversion.

**Route**: `/checkout`

---

## Layout

```
┌────────────────────────────────────────────┐
│ ← Back to Cart              Checkout       │
├────────────────────────────────────────────┤
│                                            │
│  📋 Your Information                       │
│  ──────────────────────                   │
│                                            │
│  Full Name *                               │
│  [Fatima Rahman                    ]       │
│                                            │
│  Phone Number *                            │
│  [01712345678                      ]       │ ← Auto-lookup on blur
│                                            │
│  ✅ Welcome back, Fatima! Info auto-filled │ ← If returning customer
│                                            │
│  Alternative Phone                         │
│  [                                 ]       │
│                                            │
│  Email (optional)                          │
│  [fatima@email.com                 ]       │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  📍 Delivery Address                       │
│  ──────────────────────                   │
│                                            │
│  Detailed Address *                        │
│  [House 12, Road 5, Block C       ]       │
│                                            │
│  Area *                                    │
│  [Dhanmondi                        ]       │
│                                            │
│  Thana                                     │
│  [Dhanmondi                        ]       │
│                                            │
│  District *                                │
│  [Dhaka                           ▾]       │ ← Dropdown (64 districts)
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  💳 Payment Method                         │
│  ──────────────────────                   │
│                                            │
│  ◉ Cash on Delivery (COD)                 │
│  ○ bKash                                  │
│  ○ Nagad                                  │
│  ○ Online Payment (SSLCommerz)            │
│                                            │ ← Shows based on tenant config
│  ── bKash Selected ──                     │
│  Send ৳22,700 to: 01712345678             │
│  Transaction ID *                          │
│  [TXN123456                       ]       │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  📝 Special Instructions                   │
│  [Please deliver before 10 AM     ]       │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  🛒 Order Summary                          │
│  ──────────────────────                   │
│  ┌──────────────────────────────────────┐  │
│  │ [Img] Royal Banarasi Saree          │  │
│  │       White · M · Apr 15-17         │  │
│  │       ৳13,300                       │  │
│  ├──────────────────────────────────────┤  │
│  │ [Img] Evening Gown                  │  │
│  │       Red · Free Size · Apr 20-22   │  │
│  │       ৳9,100                        │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Subtotal:            ৳12,500             │
│  Fees:                  ৳1,900             │
│  Shipping:                ৳300             │
│  Deposits:              ৳8,000             │
│  ────────────────────────────             │
│  Grand Total:          ৳22,700             │
│                                            │
│  [Confirm Booking — ৳22,700]              │
│                                            │
│  By confirming, you agree to the          │
│  rental terms and return policy.           │
│                                            │
└────────────────────────────────────────────┘
```

---

## Auto-Fill for Returning Customers

When phone number is entered and user tabs away:

1. Call `GET /api/v1/owner/customers/lookup?phone=01712345678`
2. If found → auto-fill name, email, address fields
3. Show: "✅ Welcome back, Fatima! We've filled in your details."
4. User can edit any field

---

## Payment Method Sections

### COD
No additional fields. Just a note: "Pay the full amount to the delivery person."

### bKash / Nagad (Manual)
Shows the business owner's number and a transaction ID input field.

### SSLCommerz
"Pay Now" button redirects to SSLCommerz payment page.

---

## Confirm Button States

| State | Appearance |
|---|---|
| Valid form | Enabled, brand color, shows total |
| Missing required fields | Disabled, gray |
| Submitting | Loading spinner, disabled |
| Error | Shake animation, error message above button |

---

## Desktop Layout

Two-column: form fields (60%) on left, order summary (40%) on right in a sticky panel.

---

## Validation Rules

| Field | Rules |
|---|---|
| Full Name | Required, 2+ chars |
| Phone | Required, 11 digits, starts with 01 |
| Address | Required, 5+ chars |
| Area | Required |
| District | Required (dropdown) |
| Transaction ID | Required if bKash/Nagad selected |
