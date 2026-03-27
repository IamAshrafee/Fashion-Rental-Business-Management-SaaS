# Flow: Damage Claim

## Overview

The process when an owner discovers damage on a returned item — from reporting through assessment to financial resolution.

---

## Flow Diagram

```
[Item Returned & Inspection Begins]
       │
       ├── Owner examines each returned item
       │
       ├── No damage? → DamageLevel = "none"
       │   └── Proceed to full deposit refund
       │
       ├── Damage found? ────────────────────┐
       │                                      │
       ▼                                      ▼
                                [Create Damage Report]
                                       │
                                       ├── Select damage level
                                       │   ├── Minor — small stain, loose thread
                                       │   ├── Moderate — tear, visible damage
                                       │   ├── Severe — major damage, needs repair
                                       │   ├── Destroyed — unusable
                                       │   └── Lost — item not returned
                                       │
                                       ├── Write description
                                       ├── Upload photos (evidence)
                                       ├── Enter estimated repair cost
                                       │
                                       ▼
                                [Determine Deduction]
                                       │
                                       ├── Owner decides deduction amount
                                       │   (guided by damage level, not auto-calculated)
                                       │
                                       ├── Deduction ≤ deposit?
                                       │   ├── Yes → Deduct from deposit
                                       │   │   └── Refund: deposit - deduction
                                       │   │
                                       │   └── No → Deduct full deposit
                                       │       └── additionalCharge = deduction - deposit
                                       │       └── Owner contacts customer for additional payment
                                       │
                                       ▼
                                [Process Deposit]
                                       │
                                       ├── depositStatus → "partially_refunded" or "forfeited"
                                       ├── Record refund amount, method, date
                                       │
                                       ▼
                                [Damage Report Complete]
                                       │
                                       └── Order can be completed
```

---

## Damage Levels & Suggested Actions

| Level | Description | Typical Action |
|---|---|---|
| **None** | Perfect condition | Full refund |
| **Minor** | Small stain, loose thread | ৳200-500 deduction, item still rentable |
| **Moderate** | Visible tear, stain won't wash | ৳500-2000 deduction, repair needed |
| **Severe** | Major damage, extensive repair | Large deduction, item may be retired |
| **Destroyed** | Unusable | Full deposit + additional charge |
| **Lost** | Not returned | Full deposit + retail price charge |

These are guidelines — owner has full discretion on deduction amounts.

---

## Data Model

```
DamageReport {
  bookingItemId       → links to specific rented item
  damageLevel         → severity classification
  description         → text description
  estimatedRepairCost → what repair would cost
  deductionAmount     → what's deducted from deposit
  additionalCharge    → any charge beyond deposit
  photos[]            → evidence images (MinIO)
  reportedBy          → staff/owner who filed report
}
```

One damage report per booking item (1:1 relationship).

---

## Photo Evidence

- Upload via POST /upload/damage-photo
- Stored in MinIO: `/tenant-{id}/damage/{bookingItemId}/`
- Photos are internal only — never shown to guests
- Retained for dispute resolution
