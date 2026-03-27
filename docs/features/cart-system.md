# Feature Spec: Cart System

## Overview

The cart allows guests to collect multiple products before proceeding to checkout. The cart must work **without login or account creation** — it uses browser local storage for persistence.

---

## Cart Storage Strategy

### Primary: Local Storage (Client-Side)

- Cart data stored in the browser's `localStorage`
- No backend API needed for cart CRUD
- Survives page refreshes and browser close/reopen
- Tied to the specific browser and device

### What's Stored

```json
{
  "tenantId": "abc-123",
  "items": [
    {
      "productId": "prod-001",
      "variantId": "var-002",
      "productName": "Royal Banarasi Saree",
      "variantName": "White",
      "size": "M",
      "startDate": "2026-04-15",
      "endDate": "2026-04-17",
      "rentalDays": 3,
      "featuredImage": "https://cdn.../image.webp",
      "rentalPrice": 7500,
      "depositAmount": 5000,
      "cleaningFee": 500,
      "backupSize": null,
      "backupSizeFee": 0,
      "tryOnSelected": false,
      "tryOnFee": 0,
      "addedAt": "2026-03-27T05:00:00Z"
    }
  ],
  "updatedAt": "2026-03-27T05:00:00Z"
}
```

### Why Local Storage (Not Server-Side)

- No account required — guests don't log in
- Zero backend overhead for cart operations
- Instant add/remove (no network latency)
- Simple implementation
- Acceptable limitation: cart is per-device/browser

### Cart Tenant Isolation

Cart is scoped by `tenantId`. If a user navigates to a different store (different subdomain), they see a different cart (or empty cart).

---

## Cart Operations

### Add to Cart

**Trigger**: Guest clicks "Add to Cart" on product detail page

**Required before adding**:
1. Select a variant (color) — if multiple variants exist
2. Select a size — if size mode is Standard Label
3. Select rental dates (start and end)

**On add**:
1. Check if the same product + variant + size is already in cart
   - If yes → ask: "Update dates?" or "Already in cart"
   - If no → add new item
2. Store item with current pricing snapshot
3. Show success animation/toast
4. Update cart icon badge count

### Update Cart Item

Guest can update:
- Rental dates (start/end) → recalculates rental price
- Size selection
- Backup size toggle (add/remove)
- Try-on toggle (add/remove)

Guest **cannot** change:
- Product or variant (must remove and re-add)

### Remove from Cart

- Each item has a remove/delete button
- Confirmation prompt: "Remove this item?"
- Updates cart badge count

### Clear Cart

- After successful checkout → cart is cleared
- Guest can also manually clear all items

---

## Cart Page UI

### Layout

```
🛒 Your Cart (3 items)

┌────────────────────────────────────────────────┐
│ [Image] Royal Banarasi Saree                   │
│         White · Size M                         │
│         March 15 – March 17 (3 days)           │
│         Rental: ৳7,500                         │
│         Deposit: ৳5,000                        │
│                              [Remove]          │
├────────────────────────────────────────────────┤
│ [Image] Evening Gown                           │
│         Black · Size L                         │
│         March 20 – March 22 (3 days)           │
│         Rental: ৳5,000                         │
│         Deposit: ৳3,000                        │
│                              [Remove]          │
├────────────────────────────────────────────────┤
│ [Image] Bridal Shoes                           │
│         Gold · Size 38                         │
│         March 15 – March 17 (3 days)           │
│         Rental: ৳2,000                         │
│         Deposit: ৳1,000                        │
│                              [Remove]          │
└────────────────────────────────────────────────┘

Summary
─────────────────────
Rental Subtotal:      ৳14,500
Total Deposit:        ৳9,000 (refundable)
Cleaning Fees:        ৳1,500
Shipping:             Calculated at checkout
─────────────────────
Estimated Total:      ৳25,000

[Proceed to Checkout →]
```

### Mobile Specific
- Each cart item is a card
- Swipe left to reveal delete button (optional UX)
- Sticky bottom bar: total + checkout button
- Cart is scrollable

---

## Cart Validation (Before Checkout)

When guest clicks "Proceed to Checkout":

1. **Re-check availability** for all items:
   - Call backend: `POST /api/cart/validate` with cart items
   - Backend checks: are all date ranges still available?
   - If any item is no longer available → show warning and offer to remove it

2. **Re-check pricing**:
   - Prices in localStorage may be outdated if owner changed them
   - Backend returns current prices
   - If price changed → show notification: "Price updated for [item]"
   - Update cart with fresh prices

3. **Validate dates**:
   - Start date must be in the future
   - End date must be after start date
   - Minimum rental days enforced (if product has minimum)

---

## Cart Badge (Header Icon)

- Shows number of items in cart
- Updates instantly on add/remove
- Displayed in the sticky header across all pages
- If cart is empty → no badge (or badge shows 0)

---

## Cart Expiry

Cart items do **not** expire in v1.

However, a gentle warning is shown if:
- Cart item dates are in the past: "This rental date has passed. Please update."
- Cart has been untouched for 7+ days: "Your cart has items from a while ago. Prices may have changed."

---

## Empty Cart State

When cart is empty:
```
Your cart is empty

Browse our collection and find something you love!

[Start Shopping →]
```

---

## Business Rules Summary

1. Cart is stored in localStorage — no account needed
2. Cart is scoped per tenant (per subdomain/domain)
3. Cart survives page refresh and browser close
4. Cart does NOT sync across devices
5. All prices are snapshots — validated at checkout
6. Availability is re-checked before checkout proceeds
7. Cart items don't expire but show warnings for past dates
8. Cart is cleared after successful order placement
9. Same product+variant+size cannot be added twice
