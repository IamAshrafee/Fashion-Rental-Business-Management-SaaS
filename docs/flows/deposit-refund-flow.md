# Flow: Deposit & Refund

## Overview

The lifecycle of a security deposit — from collection at booking through inspection to final refund or forfeiture.

---

## Flow Diagram

```
[Booking Created]
       │
       ├── Deposit amount set per item (snapshot from ProductServices)
       ├── BookingItem.depositStatus = "pending"
       │
       ▼
[Order Confirmed]
       │
       ├── Owner can mark deposit as "collected"
       │   (COD: on delivery / Digital: at payment verification)
       ├── BookingItem.depositStatus = "collected"
       │
       ▼
[Rental Period Active]
       │
       ├── Deposit status remains "collected" → effectively "held"
       │
       ▼
[Item Returned]
       │
       ▼
[Inspection]
       │
       ├── No damage? ────────────────────────────────────┐
       │                                                   │
       ├── Damage found? ────────────────┐                 │
       │                                 │                 │
       ▼                                 ▼                 ▼
[Damage Assessment]              [Full Refund]
       │                                 │
       ├── Damage level: minor/moderate  ├── Refund full deposit
       │   /severe/destroyed/lost        ├── Select refund method
       │                                 │   (bKash, Nagad, cash, bank)
       ├── Calculate deduction           ├── depositStatus = "refunded"
       │   ├── Partial deduction         └── SMS customer: refund processed
       │   │   └── depositStatus = "partially_refunded"
       │   └── Full forfeiture
       │       └── depositStatus = "forfeited"
       │
       ├── Deduction < deposit?
       │   ├── Yes → Refund remainder
       │   │   └── depositRefundAmount = deposit - deduction
       │   └── No → Additional charge needed
       │       ├── additionalCharge = deduction - deposit
       │       └── Owner contacts customer for payment
       │
       ▼
[Deposit Resolved]
       │
       └── Order can be marked "Completed"
```

---

## Deposit Status Lifecycle

```
pending → collected → held → refunded
                           → partially_refunded
                           → forfeited
```

| Status | Meaning |
|---|---|
| `pending` | Booking placed, deposit not yet collected |
| `collected` | Owner confirmed deposit received |
| `held` | During active rental (same as collected, semantic) |
| `refunded` | Full deposit returned to customer |
| `partially_refunded` | Deposit returned minus deductions |
| `forfeited` | Entire deposit kept due to damage/loss |

---

## Refund Methods

| Method | Process |
|---|---|
| bKash | Owner sends to customer's bKash number |
| Nagad | Owner sends to customer's Nagad number |
| Cash | Handed in person |
| Bank Transfer | Manual bank transfer |

Refund is recorded manually by owner — system tracks amount, method, and date.

---

## Business Rules

| Rule | Detail |
|---|---|
| Deposit per item | Each booking item has its own deposit amount and lifecycle |
| Snapshot pricing | Deposit amount is locked at booking time, not affected by later changes |
| No automatic refund | Owner always manually processes refunds (no automated payouts) |
| Late fees separate | Late fees are tracked separately from deposit deductions |
| Damage + late combined | Total deduction = damage deduction + late fee, capped at deposit unless additional charge |

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Customer paid deposit via COD but returned late | Late fee deducted from deposit, refund remainder |
| Deposit = ১0, item destroyed | Full forfeiture (৳০ refund) + record additional charge |
| Multiple items, mixed damage | Each item processed independently |
| Customer disputes damage | Owner can adjust deduction amount; documented in notes |
