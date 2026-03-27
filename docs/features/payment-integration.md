# Feature Spec: Payment Integration

## Overview

The payment system supports multiple payment methods common in Bangladesh. It is designed as an abstraction layer so new payment providers can be added without changing core order logic.

---

## Payment Methods

### Cash on Delivery (COD)

Most trusted payment method in Bangladesh.

- Customer pays the full amount (rental + deposit + fees) upon delivery
- No online transaction needed
- Order created with payment status = "Unpaid"
- Owner manually marks as "Paid" when cash is collected
- No integration needed — purely a status update

### bKash (Manual — v1)

For v1, bKash integration can work manually:

1. Checkout shows: "Send ৳{amount} to bKash: {ownerBkashNumber}"
2. Customer sends money via bKash app
3. Customer enters Transaction ID in the checkout form
4. Order created with payment status = "Pending Verification"
5. Owner verifies the transaction in their bKash account
6. Owner marks payment as "Verified" in dashboard

### Nagad (Manual — v1)

Same flow as bKash manual mode, with Nagad number.

### SSLCommerz (Automated — v1 or v2)

Full gateway integration supporting bKash, Nagad, cards, and bank transfer.

**Flow**:
```
Customer clicks "Pay Now"
  → Backend creates SSLCommerz session
  → Customer redirected to SSLCommerz payment page
  → Customer pays via bKash/Nagad/Card
  → SSLCommerz redirects to success/fail URL
  → Backend receives IPN (Instant Payment Notification)
  → Payment verified → Order marked as Paid
```

**SSLCommerz Integration Points**:

| Endpoint | Purpose |
|---|---|
| Init API | Create payment session with amount, order ID, customer info |
| Success URL | Customer redirected here after successful payment |
| Fail URL | Customer redirected here on payment failure |
| Cancel URL | Customer redirected here on cancellation |
| IPN URL | Webhook — reliable payment confirmation (server-to-server) |

**Important**: Always rely on IPN for payment confirmation, not the success URL redirect (which can be spoofed).

---

## Payment Architecture

```
Checkout → Payment Service → Provider Adapter → Gateway API
                                    │
                              ┌─────┴─────┐
                              │ SSLCommerz │
                              │   bKash    │
                              │   Nagad    │
                              └────────────┘
```

### Payment Service (Backend)

Abstract service with methods:
- `initiatePayment(orderId, amount, method)` → returns payment URL or instructions
- `verifyPayment(transactionId, provider)` → confirms payment
- `handleWebhook(providerPayload)` → processes IPN callback

### Provider Adapter Pattern

Each payment provider implements a common interface:

```typescript
interface PaymentProvider {
  initiate(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(transactionId: string): Promise<PaymentVerifyResult>;
  handleCallback(payload: any): Promise<PaymentCallbackResult>;
}
```

Adding a new provider = implementing this interface. No changes to core order logic.

---

## Payment Record

Every payment transaction is recorded:

| Field | Type | Description |
|---|---|---|
| Payment ID | UUID | Unique identifier |
| Order ID | UUID | Which order this payment is for |
| Amount | Number (৳) | Payment amount |
| Method | Enum | COD, bKash, Nagad, SSLCommerz |
| Status | Enum | Pending, Verified, Failed, Refunded |
| Transaction ID | String | External transaction reference |
| Provider Response | JSON | Raw response from payment gateway |
| Created At | Timestamp | When payment was initiated |
| Verified At | Timestamp | When payment was confirmed |

---

## Partial Payments

Supported scenarios:
- **Advance + COD**: Customer pays advance (e.g., 50%) via bKash, rest via COD
- **Split payments**: Multiple payment records for one order

Payment status:
- **Unpaid**: No payment received
- **Partial**: Some payment received, balance remaining
- **Paid**: Full amount received

---

## Refund Handling

| Scenario | Process |
|---|---|
| Order cancelled (before payment) | No refund needed |
| Order cancelled (after online payment) | Refund via original payment method |
| Deposit refund | Manual process — owner transfers via bKash/cash |
| Refund via SSLCommerz | Use SSLCommerz refund API |

In v1, most refunds are manual (owner sends bKash/cash). Automated refunds are a future enhancement.

---

## Tenant-Level Payment Configuration

Each tenant configures their own payment settings:

```
💳 Payment Settings

Accepted Methods:
  ✅ Cash on Delivery
  ✅ bKash (manual)
  ☐ Nagad (manual)
  ☐ SSLCommerz

bKash Number: [01712345678]
Nagad Number: [01812345678]

SSLCommerz:
  Store ID: [____________]
  Store Password: [____________]
  Mode: ○ Sandbox  ● Live
```

---

## Business Rules Summary

1. COD is always available and is the default method
2. bKash/Nagad manual mode requires owner verification
3. SSLCommerz provides automated verification via IPN
4. Payment records are stored per order
5. Partial payments are supported
6. Refunds are manual in v1
7. Payment provider adapter pattern allows easy addition of new gateways
8. Each tenant configures their own payment methods and credentials
9. IPN (webhook) is the trusted verification source, not redirect URLs
