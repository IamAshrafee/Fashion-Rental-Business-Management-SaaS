# Feature Spec: Deposit & Refund

## Overview

Security deposits protect business owners from damage and loss. This spec covers the full deposit lifecycle — collection, holding, deduction, and refund.

---

## Deposit Lifecycle

```
Customer places order (deposit included in total)
  │
  ▼
┌──────────────┐
│   COLLECTED   │  ← Deposit included in payment at checkout
└──────┬───────┘
       │
  Product delivered → customer uses → customer returns
       │
       ▼
┌──────────────┐
│   HELD        │  ← Owner has received the product back, inspecting
└──────┬───────┘
       │
  Owner inspects product
       │
  ┌────┴────────────────────┐
  │                         │
  ▼                         ▼
┌───────────────┐    ┌────────────────┐
│  FULL REFUND  │    │ PARTIAL REFUND │   ← Deductions for damage/late
└───────────────┘    └────────┬───────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                     ▼                 ▼
              ┌───────────┐    ┌──────────────┐
              │ REFUNDED  │    │  FORFEITED   │  ← Severe damage/loss
              │ (partial) │    │  (no refund) │
              └───────────┘    └──────────────┘
```

---

## Deposit Collection

### At Checkout

Deposit is shown as a separate line item during checkout:

```
Rental:           ৳7,500
Cleaning Fee:     ৳500
Security Deposit: ৳5,000 (refundable)
────────────────────
Total:            ৳13,000
```

Deposit amount is configured per product (see [service-protection.md](./service-protection.md)).

### Payment Methods for Deposit

For COD orders:
- Deposit collected at delivery along with rental payment
- Delivery agent collects total amount

For online payment:
- Deposit included in the total payment amount
- System tracks deposit portion separately for accounting

---

## Deposit Tracking (Owner Portal)

### Order Detail — Deposit Section

```
💰 Security Deposit
   Amount: ৳5,000
   Status: Held
   Collected on: April 15, 2026
   
   [Process Refund] [Report Damage]
```

### Deposit Dashboard (Summary View)

Quick overview across all orders:

```
Deposits Overview
────────────────────
Total Held:     ৳45,000 (across 9 active orders)
Pending Refund: ৳15,000 (3 orders returned, awaiting inspection)
Refunded (MTD): ৳30,000
Forfeited (MTD): ৳5,000
```

---

## Refund Process

### Full Refund (No Issues)

1. Product returned on time
2. Owner inspects — no damage
3. Owner clicks "Process Full Refund"
4. Deposit status changes to "Refunded"
5. Order moves to "Completed"

**Refund method**: Same as collection method, or manual (bKash transfer, cash return). Owner records refund details.

### Partial Refund (Deductions Applied)

1. Product returned with issues (late return or damage)
2. Owner calculates deductions:
   ```
   Deposit:         ৳5,000
   Late Fee (2 days): -৳2,000
   ────────────────
   Refund Amount:   ৳3,000
   ```
3. Owner clicks "Process Partial Refund"
4. Enters refund amount and reason
5. Deposit status changes to "Partially Refunded"

### No Refund (Full Forfeiture)

1. Product severely damaged or lost
2. Deductions ≥ deposit amount
3. Owner clicks "Forfeit Deposit"
4. Enters reason
5. Deposit status changes to "Forfeited"
6. If damage cost exceeds deposit → additional charges apply (see [damage-loss-handling.md](./damage-loss-handling.md))

---

## Deposit Status Values

| Status | Meaning |
|---|---|
| **Pending** | Order placed, deposit not yet collected (COD) |
| **Collected** | Deposit received from customer |
| **Held** | Product returned, deposit held pending inspection |
| **Refunded** | Full deposit returned to customer |
| **Partially Refunded** | Deposit returned minus deductions |
| **Forfeited** | Full deposit kept by business |

---

## Refund Record

When a refund is processed:

| Field | Value |
|---|---|
| Original Amount | ৳5,000 |
| Deductions | ৳2,000 (late fee) |
| Refund Amount | ৳3,000 |
| Refund Method | bKash to 01712345678 |
| Refund Date | April 20, 2026 |
| Processed By | Owner name |
| Notes | "2 days late, no damage" |

This record is attached to the order and visible in timeline.

---

## Accounting Treatment

Deposits are **not revenue**. They are held funds.

| Action | Accounting |
|---|---|
| Deposit collected | Liability (money owed to customer) |
| Deposit refunded | Liability reduced |
| Deposit forfeited | Liability converted to revenue (damage compensation) |
| Late fee deducted | Portion of liability converted to revenue |

This distinction is important for accurate financial reporting.

---

## Business Rules Summary

1. Deposit amount is per product, configured by owner
2. Deposit is always shown separately from rental price
3. Deposit is collected at checkout (in total payment)
4. Deposit is trackable per order
5. Refund is a manual owner action after inspection
6. Owner can issue full refund, partial refund, or forfeit
7. Deductions (late fees, damage) are subtracted from deposit
8. If deductions > deposit → customer owes the difference
9. Deposit is a liability, not revenue, until forfeited
10. Refund record includes method, amount, date, and notes
