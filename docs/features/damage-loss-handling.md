# Feature Spec: Damage & Loss Handling

## Overview

Handles situations where a rented product is returned damaged, or is lost/not returned. This is a critical business protection feature that determines financial responsibility.

---

## Damage Assessment Flow

```
Product returned
  │
  ▼
Owner inspects product
  │
  ├── No damage → Full deposit refund
  │
  ├── Minor damage (repairable) → Deduct repair cost from deposit
  │
  ├── Major damage (beyond repair) → Forfeit deposit + possible additional charge
  │
  └── Product lost / not returned → Forfeit deposit + charge full retail price
```

---

## Damage Report

### When Owner Finds Damage

After marking an order as "Returned" → Owner inspects → If damage found:

1. Owner clicks "Report Damage"
2. Opens damage assessment form

### Damage Report Fields

| Field | Type | Required |
|---|---|---|
| Damage Level | Dropdown | Yes |
| Description | Textarea | Yes |
| Photos | Image upload (up to 5) | Recommended |
| Estimated Repair Cost | Number (৳) | If repairable |
| Deduction Amount | Number (৳) | Yes |
| Action | Dropdown | Yes |

### Damage Levels

| Level | Description | Typical Action |
|---|---|---|
| **None** | No damage, normal wear | Full deposit refund |
| **Minor** | Small stain, loose thread, missing button | Deduct repair cost (৳200-1,000) |
| **Moderate** | Noticeable tear, significant stain, missing accessory | Deduct repair cost or partial retail value |
| **Severe** | Major tear, permanent stain, structural damage | Forfeit deposit, may charge additional |
| **Destroyed** | Product unusable, cannot be repaired | Forfeit deposit + charge full retail value |
| **Lost** | Product not returned | Forfeit deposit + charge full retail value |

### Actions

| Action | Financial Impact |
|---|---|
| **Deduct from deposit** | Repair cost subtracted, remaining deposit refunded |
| **Forfeit deposit** | Full deposit kept by business |
| **Forfeit deposit + additional charge** | Deposit kept + customer owes more |

---

## Financial Calculation

### Minor/Moderate Damage

```
Security Deposit:      ৳5,000
Repair Cost:           ৳1,500
─────────────────────
Deposit Refund:        ৳3,500
Customer Owes:         ৳0
```

### Severe Damage

```
Security Deposit:      ৳5,000
Damage Cost:           ৳8,000
─────────────────────
Deposit Refund:        ৳0
Customer Owes:         ৳3,000 (beyond deposit)
```

### Product Lost

```
Security Deposit:      ৳5,000
Retail/Purchase Price: ৳45,000
─────────────────────
Deposit Refund:        ৳0
Customer Owes:         ৳40,000 (full retail minus deposit)
```

---

## Owner Portal — Damage Report View

### On Order Detail Page (After Damage Report)

```
⚠️ Damage Report
─────────────────────
Level: Moderate
Description: "Small tear on the left sleeve seam, approximately 2 inches"
Repair Cost: ৳1,500
Photos: [📷] [📷]

Financial Impact:
  Deposit: ৳5,000
  Deduction: -৳1,500 (repair)
  Refund: ৳3,500

[Process Refund] [Edit Report]
```

### On Product Page (Damage History)

```
📋 Damage History
  April 18, 2026 — Moderate damage (sleeve tear) — ৳1,500 deducted
  Feb 10, 2026 — Minor damage (small stain) — ৳500 deducted
  
  Total damage costs: ৳2,000
  Total rentals earned: ৳22,500
```

---

## Customer Communication

### When Damage Is Reported

Owner should be able to:
1. Document damage with photos (evidence)
2. Notify customer via SMS with damage details and deduction amount
3. Customer sees deduction in their order summary (if guest accounts exist in future)

### Dispute Handling (v1 — Manual)

In v1, disputes are handled manually:
- Customer contacts business via phone/WhatsApp
- Owner reviews evidence
- Owner can adjust the deduction amount
- All changes logged in order timeline

### Future Enhancement
- Formal dispute system
- Customer can submit counter-evidence
- Escalation to SaaS admin

---

## Product Impact

When damage is reported:

| Damage Level | Product Status Impact |
|---|---|
| Minor | No change — product remains available after repair |
| Moderate | Owner may temporarily set product as "Not Available" during repair |
| Severe | Product likely set as "Not Available" permanently or archived |
| Destroyed | Product archived with damage reason |
| Lost | Product archived with loss reason |

### Automatic Suggestions (Future)

When damage is "Destroyed" or "Lost", system could suggest:
- Archive the product
- Update target tracking (cost recovery no longer possible)
- Mark insurance claim (if applicable)

---

## Reporting

### Damage Analytics (Owner Dashboard)

| Metric | Description |
|---|---|
| Total Damage Incidents | Count of damage reports in period |
| Total Damage Cost | Sum of deductions/charges |
| Most Damaged Products | Products with most damage reports |
| Damage Rate | Percentage of rentals that had damage |
| Average Deduction | Mean deduction amount per incident |

---

## Business Rules Summary

1. Damage assessment is a manual owner process after product inspection
2. Damage is documented with level, description, and photos
3. Deductions are subtracted from the security deposit
4. If damage cost exceeds deposit, customer owes the difference
5. Lost products are charged at full retail/purchase price
6. All damage reports are logged and linked to the order
7. Product may need status change depending on damage severity
8. In v1, disputes are handled manually via direct communication
9. Damage history is tracked per product for future reference
