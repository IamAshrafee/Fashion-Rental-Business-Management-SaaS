# Integration: Nagad (Manual Transfer)

## Overview

Identical flow to bKash — manual transfer to owner's Nagad number, manual verification.

---

## Configuration (Per-Tenant)

```json
{
  "paymentMethods": {
    "nagad": {
      "enabled": true,
      "accountNumber": "01612345678"
    }
  }
}
```

---

## Guest Checkout UI

```
💳 Nagad

Send ৳22,700 to this number:
📱 01612345678 [Copy]

Steps:
1. Open Nagad app
2. Send Money → 01612345678
3. Amount: ৳22,700
4. Enter your Transaction ID below

Transaction ID *
[________________________]
```

---

## Verification

Same as bKash: owner checks Nagad app, matches TXN ID & amount, records in system.

---

## Future: Nagad PGW API

Same upgrade path as bKash — merchant account + API integration for automated verification.
