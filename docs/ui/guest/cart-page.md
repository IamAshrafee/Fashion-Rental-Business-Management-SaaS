# UI Spec: Cart Page

## Overview

Review items before checkout. Cart data from localStorage.

**Route**: `/cart`

---

## Layout

```
┌────────────────────────────────────────────┐
│ ← Continue Shopping         Your Cart (2)   │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ [Img]  Royal Banarasi Saree         │  │
│  │        White — Ivory Gold            │  │
│  │        Size: M · Backup: L           │  │
│  │        Apr 15 → Apr 17 (3 days)      │  │
│  │                                      │  │
│  │        Rental:    ৳7,500             │  │
│  │        Cleaning:    ৳500             │  │
│  │        Backup:      ৳300             │  │
│  │        Deposit:   ৳5,000             │  │
│  │        ────────────────              │  │
│  │        Subtotal: ৳13,300             │  │
│  │                                      │  │
│  │        [Change Dates] [Remove]       │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ [Img]  Evening Gown                 │  │
│  │        Red                           │  │
│  │        Free Size                     │  │
│  │        Apr 20 → Apr 22 (3 days)      │  │
│  │                                      │  │
│  │        Rental:    ৳5,000             │  │
│  │        Cleaning:    ৳300             │  │
│  │        Try-on:      ৳800             │  │
│  │        Deposit:   ৳3,000             │  │
│  │        ────────────────              │  │
│  │        Subtotal:  ৳9,100             │  │
│  │                                      │  │
│  │        [Change Dates] [Remove]       │  │
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  Order Summary                             │
│  ──────────────────────────────           │
│  Subtotal (2 items):     ৳12,500          │
│  Cleaning fees:             ৳800          │
│  Backup size fee:           ৳300          │
│  Try-on fee:                ৳800          │
│  Shipping:                  ৳300          │
│  Deposits (refundable):   ৳8,000          │
│  ──────────────────────────────           │
│  Total:                  ৳22,700          │
│                                            │
│  [Proceed to Checkout →]                   │
│                                            │
└────────────────────────────────────────────┘
```

---

## Cart Item Actions

### Change Dates

Opens inline date picker to update rental dates. Recalculates price. Checks availability for new dates.

### Remove Item

Confirm dialog → remove from localStorage → animate out. If last item removed, show empty cart.

---

## Empty Cart

```
┌────────────────────────────────────────────┐
│                                            │
│         🛒                                 │
│         Your cart is empty                 │
│                                            │
│         Browse our collection and find     │
│         your perfect outfit!               │
│                                            │
│         [Browse Products →]                │
│                                            │
└────────────────────────────────────────────┘
```

---

## Validation Before Checkout

When user clicks "Proceed to Checkout":

1. Call `POST /api/v1/cart/validate` with all cart items
2. If all valid → navigate to checkout
3. If any item unavailable → show warning:

```
⚠️ Some items are no longer available:

Royal Banarasi Saree is booked for Apr 15-17.
[Change Dates] or [Remove from Cart]
```

---

## Desktop Layout

Side-by-side: cart items on left (65%), order summary on right (35%) in a sticky panel.
