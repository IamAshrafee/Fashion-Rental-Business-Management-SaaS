# Flow: Payment Processing

## Overview

All payment paths — from checkout initiation through verification to recording in the system.

---

## Payment Methods Overview

| Method | Type | Verification | Available To |
|---|---|---|---|
| COD | Offline | Owner manually records | All tenants |
| bKash | Manual transfer | Owner verifies via app, records | Configured tenants |
| Nagad | Manual transfer | Owner verifies via app, records | Configured tenants |
| SSLCommerz | Online gateway | Automated IPN verification | Pro plan tenants |

---

## Flow A: Cash on Delivery (COD)

```
[Guest selects COD at checkout]
       │
       ├── No extra fields required
       ├── POST /bookings → booking created
       │   ├── paymentMethod = "cod"
       │   ├── paymentStatus = "unpaid"
       │
       ▼
[Order Delivered]
       │
       ├── Delivery person collects cash
       │
       ▼
[Owner Records Payment]
       │
       ├── POST /owner/bookings/:id/payments
       │   ├── amount, method: "cod", notes
       │   └── paymentStatus auto-updates:
       │       ├── totalPaid < grandTotal → "partial"
       │       └── totalPaid ≥ grandTotal → "paid"
       │
       ▼
[Payment Recorded ✅]
```

---

## Flow B: bKash / Nagad (Manual Transfer)

```
[Guest selects bKash/Nagad at checkout]
       │
       ├── UI shows: "Send ৳22,700 to 01712345678"
       ├── Guest sends money via bKash/Nagad app
       ├── Guest enters Transaction ID in checkout form
       │
       ▼
[POST /bookings]
       │
       ├── paymentMethod = "bkash" / "nagad"
       ├── Booking created with paymentStatus = "unpaid"
       ├── Transaction ID stored in booking notes (reference)
       │
       ▼
[Owner Sees New Booking]
       │
       ├── Owner checks bKash/Nagad app for transaction
       ├── Finds matching amount + transaction ID
       │
       ▼
[Owner Records & Verifies Payment]
       │
       ├── POST /owner/bookings/:id/payments
       │   ├── amount, method: "bkash", transactionId
       │   └── status: "verified"
       │
       ▼
[Payment Verified ✅]
```

---

## Flow C: SSLCommerz (Online Payment)

```
[Guest selects Online Payment at checkout]
       │
       ▼
[POST /payments/initiate]
       │
       ├── Server creates SSLCommerz session:
       │   ├── total_amount = grandTotal
       │   ├── tran_id = "BOOKING-{uuid}"
       │   ├── success_url = /payments/sslcommerz/success
       │   ├── fail_url = /payments/sslcommerz/fail
       │   ├── cancel_url = /payments/sslcommerz/cancel
       │   ├── ipn_url = /payments/sslcommerz/ipn
       │   └── customer info
       │
       ├── SSLCommerz returns: payment gateway URL
       │
       ▼
[Guest Redirected to SSLCommerz]
       │
       ├── Guest completes payment (card/mobile banking/etc)
       │
       ├── Success? ────────────────────────────────┐
       │                                             │
       ├── Failed? ─────────────────────┐            │
       │                                │            │
       ├── Cancelled? ──────┐           │            │
       │                    │           │            │
       ▼                    ▼           ▼            ▼
                     [/cancel]    [/fail]      [/success]
                         │           │              │
                         │           ▼              │
                         │    Show error,           │
                         │    retry option           │
                         │                          │
                         ▼                          ▼
                    Back to cart          [SSLCommerz IPN → /ipn]
                                                │
                                                ├── Verify IPN signature
                                                ├── Verify IP whitelist
                                                ├── Match tran_id to booking
                                                ├── Verify amount matches
                                                │
                                                ├── Valid?
                                                │   ├── Yes:
                                                │   │   ├── Create Payment record
                                                │   │   ├── paymentStatus → "paid"
                                                │   │   ├── Store raw IPN in providerResponse
                                                │   │   └── SMS customer: payment confirmed
                                                │   │
                                                │   └── No:
                                                │       └── Log fraudulent attempt
                                                │
                                                ▼
                                         [Payment Complete ✅]
```

---

## Payment Status Logic

```javascript
function updatePaymentStatus(booking) {
  if (totalPaid === 0) return 'unpaid';
  if (totalPaid < grandTotal) return 'partial';
  return 'paid';
}
```

Multiple payment records allowed per booking (partial payments).

---

## Security Considerations

| Concern | Mitigation |
|---|---|
| SSLCommerz IPN spoofing | Verify IP whitelist + signature hash |
| Amount manipulation | Server recalculates total, never trusts client amount |
| Double payment recording | Check for duplicate transaction IDs |
| Race condition on payment | Use DB transaction for payment + status update |
