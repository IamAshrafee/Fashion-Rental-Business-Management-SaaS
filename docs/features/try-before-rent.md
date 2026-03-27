# Feature Spec: Try-Before-You-Rent

## Overview

Sizing is the biggest risk in fashion rental. Customers worry that the dress won't fit, especially when renting high-value items. This feature lets customers try on the product for a short period (typically 24 hours) before committing to the full rental.

This is an optional, per-product feature.

---

## Configuration (Owner)

| Field | Type | Required | Description |
|---|---|---|---|
| Enable Try-On | Toggle | No | Turns the feature on/off for this product |
| Try-On Fee | Number (৳) | Yes (if enabled) | Fee charged for the try-on period |
| Try-On Duration | Number (hours) | Yes (if enabled) | How long the customer gets to try (default: 24 hours) |
| Credit to Rental | Toggle | No | Whether the try-on fee is credited toward the final rental cost |

### Example Configuration
- Try-On Fee: ৳1,000
- Duration: 24 hours
- Credit to Rental: Yes

---

## How It Works

### Customer Flow

1. Customer visits product detail page
2. Sees "Try Before You Rent" option (only if enabled for this product)
3. Customer selects "Try Before You Rent"
4. Customer selects a try-on date
5. **System checks**: Try-on date must be **before** the event/rental dates (ideally weeks before)
6. Customer pays the try-on fee at checkout
7. Product is shipped/delivered for try-on
8. Customer has 24 hours (or configured duration) to try the product
9. Customer decides:
   - **Yes, I want to rent** → Proceeds with full booking for event dates. Try-on fee credited to rental total (if configured).
   - **No, I don't want it** → Returns the product. Try-on fee is non-refundable.

### Timeline Example

```
March 1:   Customer books try-on for March 5
March 5:   Product delivered for try-on
March 6:   24 hours up — customer decides YES
March 6:   Customer books rental for March 20-22 (wedding day)
March 20:  Product delivered for rental
March 22:  Product returned
Checkout:  Try-on fee (৳1,000) credited to rental total
```

---

## Display Rules (Guest Side)

### Product Detail Page

If try-on is enabled, show a section:

```
👗 Try Before You Rent
Try this outfit for 24 hours before your event
Fee: ৳1,000 (credited to your rental if you book!)
[Request Try-On →]
```

If credit is NOT enabled:
```
Fee: ৳1,000 (non-refundable)
```

### Checkout (Try-On Only)

If customer only selects try-on (not booking):

```
Order Summary
─────────────
Royal Saree — Try-On
Duration: 24 hours
Try-On Fee: ৳1,000
Shipping: ৳150
─────────────
Total: ৳1,150
```

### Checkout (Try-On + Rental Booking)

If customer books both try-on and rental in one flow:

```
Order Summary
─────────────
Royal Saree — Try-On (March 5-6)
  Try-On Fee: ৳1,000

Royal Saree — Rental (March 20-22)
  Rental (3 days): ৳7,500
  Deposit: ৳5,000
  Cleaning: ৳500
  Try-On Credit: -৳1,000
  ──────────────
  Rental Subtotal: ৳12,000

Total: ৳13,150
```

---

## Availability Interaction

- Try-on bookings **block the product** for the try-on period (same as a regular booking)
- If a customer tries-on from March 5-6, no one else can book those dates
- If the customer declines after try-on, dates become available again
- Try-on period must not overlap with existing bookings

---

## Business Rules Summary

1. Try-on is optional, enabled per product
2. Try-on fee is always charged upfront
3. If customer declines → fee is non-refundable
4. If customer books → fee can be credited to rental total (if configured)
5. Try-on blocks product availability for the duration
6. Try-on duration is configurable (default 24 hours)
7. Try-on date should be before the actual event/rental dates
8. Only one try-on can be active per product at a time
9. Try-on creates a separate order type: "Try-On Order"
