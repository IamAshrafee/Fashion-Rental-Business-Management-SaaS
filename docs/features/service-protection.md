# Feature Spec: Service & Protection Options

## Overview

Optional fees and add-ons that protect both the business and the customer. These fields are configured per product. If left empty, they are not applied — no defaults are forced.

---

## Security Deposit

### Purpose
A refundable amount collected before rental to cover potential damage, loss, or unreturned items. Returned to the customer after the item is inspected and returned in acceptable condition.

### Configuration (Owner)

| Field | Type | Required | Example |
|---|---|---|---|
| Deposit Amount | Number (৳) | No | 5,000৳ |

If not set → no deposit required for this product.

### Lifecycle

```
Customer books → Deposit collected at checkout
  → Product delivered → Customer uses it
  → Customer returns → Owner inspects
  → If OK → Full deposit refunded
  → If damaged → Partial or no refund (see damage-loss-handling.md)
  → If lost → No refund, additional charges may apply
```

### Display Rules
- On product detail page: Show deposit amount with "refundable" label
- On checkout: Shown as a separate line item, clearly marked
- On booking confirmation: "Deposit: ৳5,000 (refundable upon return)"

### Business Rules
1. Deposit is always refundable unless damage/loss occurs
2. Deposit amount is per product, not per order
3. If multiple products in cart, each product's deposit is shown separately
4. Deposit refund is a manual action by the owner (after inspection)
5. Deposit is NOT counted as revenue — it's a held amount

---

## Cleaning Fee

### Purpose
A non-refundable flat fee charged per rental to cover professional cleaning after the product is returned. Covers dry cleaning, pressing, and preparation for the next rental.

### Configuration (Owner)

| Field | Type | Required | Example |
|---|---|---|---|
| Cleaning Fee | Number (৳) | No | 500৳ |

If not set → no cleaning fee for this product.

### Display Rules
- On product detail page: Show as a separate line in pricing section
- On checkout: Separate line item
- Always clearly marked as "non-refundable"

### Business Rules
1. Cleaning fee is a one-time charge per rental (not per day)
2. Non-refundable, even if booking is cancelled (depends on cancellation policy — future feature)
3. Applied per product

---

## Backup Size

### Purpose
Some customers are unsure about sizing. This feature allows them to add a second size of the same product for a discounted fee, ensuring a perfect fit. The customer returns the size that doesn't fit.

### Configuration (Owner)

| Field | Type | Required | Description |
|---|---|---|---|
| Enable Backup Size | Toggle | No | Turns the feature on/off for this product |
| Backup Size Fee | Number (৳) | Yes (if enabled) | Discounted price for the extra size |

**Example**: Backup size fee = ৳500

### How It Works
1. Owner enables backup size for a product and sets the fee
2. On the guest side, a "Add backup size" option appears during booking
3. Guest pays the extra fee
4. Business ships both sizes
5. Guest keeps the one that fits, returns the other
6. Both must be returned by the return date

### Display Rules (Guest Side)
- On product detail page: "Add backup size for just ৳500" (shown only if enabled)
- Checkbox/toggle for the guest to opt in
- In cart: Shown as an add-on line item under the product

### Business Rules
1. Only available for products with Standard Label Size mode
2. Guest must select a different size from their primary size
3. Both sizes must be returned
4. Backup size fee is non-refundable
5. If only one size is returned → customer charged retail price for the missing one
6. Availability is not checked per-size in v1 (product-level availability only)

---

## Interaction Between Services

These options are independent of each other. A product can have:
- Only deposit
- Only cleaning fee
- Both deposit and cleaning fee
- Deposit + cleaning fee + backup size
- None of the above

### Combined Display Example (Product Detail Page)

```
Pricing
───────
Rental: ৳7,500 (3 days)
Security Deposit: ৳5,000 (refundable)
Cleaning Fee: ৳500
+ Add backup size: ৳500 (optional)
```

### Combined Checkout Example

```
Royal Saree (White, Size M)
  Rental (3 days):           ৳7,500
  Security Deposit:          ৳5,000  (refundable)
  Cleaning Fee:              ৳500
  Backup Size (L):           ৳500
  ─────────────────────────────
  Item Total:                ৳13,500
  (৳5,000 refundable upon return)
```

---

## Business Rules Summary

1. All service options are optional — empty means not applied
2. Deposit is refundable; cleaning fee and backup size fee are not
3. All amounts are per product, not per order
4. Owner controls whether each is enabled per product
5. Backup size is only available for Standard Label Size products
6. Deposit refund is a manual owner action after product return and inspection
