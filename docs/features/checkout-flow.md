# Feature Spec: Checkout Flow

## Overview

The checkout is the final step before a booking is created. It must be **extremely simple** — especially for Bangladeshi users who may not be comfortable with complex online forms. Every unnecessary field or step reduces conversion.

---

## Checkout Steps

The checkout is a **single page** with clear sections — NOT a multi-step wizard. Users should see everything at once so they know what's expected.

### Section 1: Customer Information

| Field | Type | Required | Validation |
|---|---|---|---|
| Full Name | Text | Yes | Min 2 characters |
| Phone Number | Text | Yes | BD format: 01XXXXXXXXX (11 digits) |
| Alternative Phone | Text | No | BD format if provided |
| Delivery Address | Textarea | Yes | Min 10 characters |
| Area | Text | Yes | e.g., "Dhanmondi" |
| Thana | Text | No | e.g., "Dhanmondi Thana" |
| District | Dropdown | Yes | List of BD districts |
| Special Instructions | Textarea | No | Max 500 characters |

**Auto-fill for returning customers**: If the phone number matches an existing customer (for this tenant), auto-fill name and address. Guest can still edit.

**Address format note**: Bangladesh address format is simple. Avoid complex dropdowns. A text field for address + Area + District is enough.

### Section 2: Order Summary

Display all cart items with full breakdown:

```
Order Summary
─────────────────────────────

Royal Banarasi Saree
  Variant: White · Size: M
  Dates: April 15 – April 17 (3 days)
  Rental:          ৳7,500
  Deposit:         ৳5,000 (refundable)
  Cleaning Fee:    ৳500

Evening Gown
  Variant: Black · Size: L
  Dates: April 20 – April 22 (3 days)
  Rental:          ৳5,000
  Deposit:         ৳3,000 (refundable)
  Cleaning Fee:    ৳300

─────────────────────────────
Rental Subtotal:       ৳12,500
Cleaning Fees:         ৳800
Shipping:              ৳150
Security Deposits:     ৳8,000 (refundable)
─────────────────────────────
Total Payable:         ৳21,450
(includes ৳8,000 refundable deposit)
```

### Section 3: Payment Method

| Option | Description |
|---|---|
| **Cash on Delivery** | Pay when product is delivered. Most trusted in Bangladesh. |
| **bKash** | Mobile payment — redirects to bKash or shows payment instructions |
| **Nagad** | Mobile payment — similar flow to bKash |
| **Online Payment** | Card/other via SSLCommerz gateway |

**Default selected**: Cash on Delivery (highest trust in Bangladesh)

**For bKash/Nagad (manual mode)**:
If payment gateway is not integrated, show instructions:
```
Send ৳21,450 to bKash: 01XXXXXXXXX
Transaction ID: [input field]
```

Owner verifies manually from their dashboard.

**For SSLCommerz (automated)**:
- Guest clicks "Pay Now" → redirected to SSLCommerz
- After payment → callback to our system → booking created with "Paid" status

---

## Place Order Button

**Bottom of page** (fixed position on mobile):

```
[Confirm Booking — ৳21,450]
```

Button shows the total amount for clarity.

### On Click:

1. **Validate** all required fields
2. **Re-validate** cart item availability (final check)
3. **Show loading** state on button ("Placing your order...")
4. **Send** booking creation request to backend
5. **On success**: Redirect to booking confirmation page
6. **On failure**: Show error message, keep form filled

### Validation Errors

Show inline validation:
```
Phone Number: Please enter a valid 11-digit number
Delivery Address: Address is required
```

All errors shown at once (not one at a time).

---

## Backend — Order Creation

When the checkout form is submitted:

```
POST /api/bookings

Body:
{
  "customer": {
    "name": "Fatima Rahman",
    "phone": "01712345678",
    "altPhone": "01812345679",
    "address": "House 12, Road 5, Dhanmondi",
    "area": "Dhanmondi",
    "thana": "Dhanmondi",
    "district": "Dhaka"
  },
  "items": [
    {
      "productId": "prod-001",
      "variantId": "var-002",
      "size": "M",
      "startDate": "2026-04-15",
      "endDate": "2026-04-17",
      "backupSize": null,
      "tryOn": false
    }
  ],
  "paymentMethod": "cod",
  "notes": "Please deliver before 10 AM",
  "transactionId": null
}
```

**Backend processing:**
1. Resolve tenant from request context
2. Find or create customer record (by phone number)
3. Validate all items: product exists, variant exists, dates available
4. Calculate prices (server-side — do not trust client prices)
5. Create booking record with status = "Pending"
6. Block dates in availability system
7. Send notifications (owner notification + guest SMS)
8. Return booking confirmation data

---

## Checkout - Edge Cases

| Scenario | Handling |
|---|---|
| Item becomes unavailable during checkout | Show error: "Sorry, [item] is no longer available for your selected dates. Please remove it or change dates." Don't block the entire checkout — let them proceed with remaining items. |
| Price changed since cart was loaded | Show updated prices. If significant change, highlight the difference. |
| Network error during submission | Show retry button. Keep form filled. |
| Duplicate submission (double click) | Disable button after first click + server-side idempotency check |
| Phone number format wrong | Inline validation: "Please enter a valid 11-digit BD phone number" |

---

## Business Rules Summary

1. Checkout is a single page, not a multi-step wizard
2. No account creation required
3. Phone number is required — used for customer matching
4. Address uses simple Bangladesh format (area + thana + district)
5. Prices are recalculated server-side (client values are not trusted)
6. Availability is re-verified at booking creation time
7. Booking created with "Pending" status regardless of payment method
8. COD is the default payment method
9. Cart is cleared after successful booking
10. Auto-fill for returning customers (matched by phone)
