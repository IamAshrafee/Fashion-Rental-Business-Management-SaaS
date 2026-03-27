# Integration: bKash (Manual Transfer)

## Overview

bKash is used as a **manual payment method** — customers send money directly to the business owner's bKash personal/merchant number. No API integration; verification is manual.

---

## How It Works

```
[Checkout: bKash selected]
       │
       ├── UI shows: "Send ৳22,700 to 01712345678"
       ├── Customer opens bKash app → sends money → gets TXN ID
       ├── Customer enters TXN ID in checkout form
       │
       ▼
[Booking Created]
       │
       ├── paymentMethod: "bkash"
       ├── paymentStatus: "unpaid"
       ├── Transaction ID stored in booking notes
       │
       ▼
[Owner Verification]
       │
       ├── Owner opens bKash app
       ├── Checks transaction history for matching amount
       ├── Finds TXN ID → confirms it's legitimate
       │
       ▼
[Owner Records Payment]
       │
       ├── Records amount, method: "bkash", TXN ID
       └── paymentStatus → "paid"
```

---

## Configuration (Per-Tenant)

```json
{
  "paymentMethods": {
    "bkash": {
      "enabled": true,
      "accountNumber": "01712345678",
      "accountType": "personal"
    }
  }
}
```

| Field | Description |
|---|---|
| `enabled` | Whether bKash is offered at checkout |
| `accountNumber` | Owner's bKash number shown to customers |
| `accountType` | "personal" or "merchant" (display purposes) |

---

## Guest Checkout UI

```
💳 bKash

Send ৳22,700 to this number:
📱 01712345678 [Copy]

Steps:
1. Open bKash app
2. Send Money → 01712345678
3. Amount: ৳22,700
4. Enter your Transaction ID below

Transaction ID *
[________________________]
```

---

## Future: bKash Payment Gateway API

If bKash PGW is integrated in the future:

- Apply for bKash Payment Gateway merchant account
- Implement: `createPayment`, `executePayment`, `queryPayment`
- Switch from manual to automated verification
- Existing manual flow remains as fallback
