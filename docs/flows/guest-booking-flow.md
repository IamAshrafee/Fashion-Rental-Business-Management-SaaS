# Flow: Guest Booking (Browse → Book → Confirm)

## Overview

The complete end-to-end journey of a guest renting a product — from discovery to booking confirmation.

---

## Flow Diagram

```
[Guest lands on store]
       │
       ▼
[Browse / Search / Filter products]
       │
       ▼
[View product detail page]
       │
       ├── Select variant (color)
       ├── Pick rental dates (calendar)
       ├── Toggle try-on / backup size
       │
       ▼
[Add to Cart]  ←── Item saved to localStorage
       │
       ▼
[View Cart] ←── Can edit dates / remove items
       │
       ▼
[Proceed to Checkout]
       │
       ├── POST /cart/validate → verify availability + recalculate prices
       │   ├── ✅ Valid → continue
       │   └── ❌ Conflict → show warning, prompt to change dates/remove
       │
       ▼
[Checkout Form]
       │
       ├── Enter name, phone, address
       │   └── Phone blur → GET /customers/lookup → auto-fill if returning customer
       ├── Select payment method
       │   ├── COD → no extra input
       │   ├── bKash/Nagad → enter transaction ID
       │   └── SSLCommerz → redirect to gateway
       ├── Add special instructions (optional)
       │
       ▼
[Confirm Booking]
       │
       ├── POST /bookings (server-side)
       │   ├── Validate all product availability (double-check)
       │   ├── Recalculate ALL prices from DB (never trust client)
       │   ├── Create/find Customer by phone (dedup)
       │   ├── Create Booking + BookingItems (with price snapshots)
       │   ├── Create DateBlocks (type: pending)
       │   ├── Generate booking number (ORD-2026-XXXX)
       │   ├── Send SMS to owner: "New ৳13K booking"
       │   └── Return booking confirmation
       │
       ▼
[Booking Confirmation Page]
       │
       ├── Show booking number, timeline, delivery info
       ├── "Continue Shopping" link
       └── Cart cleared from localStorage
```

---

## Key Business Rules

| Rule | Detail |
|---|---|
| **Price trust** | Client-side prices are for display only. Server recalculates everything at booking time |
| **Double availability check** | Checked at cart validation AND again at booking creation (prevents race conditions) |
| **Customer dedup** | Identified by `tenant_id + phone`. Auto-merges if same phone number books again |
| **Date blocking** | Pending bookings create `pending` date blocks. Confirmed bookings upgrade to `booking` type. Cancelled bookings release blocks |
| **No account required** | Zero-friction guest checkout. No registration, no login, no email verification |
| **SMS notification** | Owner gets instant SMS on new booking if SMS is enabled |

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Product becomes unavailable between cart add and checkout | Show conflict warning, offer to change dates |
| Price changes between browse and checkout | Server uses current prices; updated total shown in confirmation |
| Same guest books twice with same phone | Same customer record reused, address auto-filled |
| Page refresh during checkout | localStorage cart preserved; checkout form state NOT preserved |
| SSLCommerz payment fails | Redirect to checkout with error; booking NOT created until payment succeeds |
| Multiple tabs booking same product | First booking to complete gets the dates; second gets conflict error |

---

## Touchpoints

| System | Action |
|---|---|
| Frontend | Cart management, checkout form, validation UI |
| API | `/cart/validate`, `/bookings`, `/customers/lookup` |
| Database | customers, bookings, booking_items, date_blocks, payments |
| SMS | Owner notification on new booking |
| Redis | Rate limiting on checkout endpoint |
