# P08 — Payment & Deposit System (Backend)

| | |
|---|---|
| **Phase** | 3 — Transaction Engine |
| **Estimated Time** | 3–4 hours |
| **Requires** | P07 (booking engine) |
| **Unlocks** | P14, P18 |

---

## REFERENCE DOCS

- `docs/features/payment-integration.md` — Payment methods, gateway integration
- `docs/features/deposit-refund.md` — Deposit lifecycle
- `docs/features/damage-loss-handling.md` — Damage reports, deposit deductions
- `docs/database/payment.md` — payments table
- `docs/database/booking-item.md` — deposit fields, damage_reports
- `docs/api/payment.md` — Payment endpoints
- `docs/flows/payment-flow.md` — Payment processing flow
- `docs/flows/deposit-refund-flow.md` — Deposit refund workflow
- `docs/flows/damage-claim-flow.md` — Damage claim workflow
- `docs/integrations/sslcommerz.md` — SSLCommerz integration

---

## SCOPE

### 1. Payment Recording

**Manual payments (COD, bKash, Nagad):**
- `POST /api/v1/bookings/:id/payments` — record payment
- Fields: amount, method, reference_number, notes
- Update booking.total_paid and booking.payment_status
- Emit `payment.received` event

**SSLCommerz integration:**
- Initiate payment session: `POST /api/v1/payments/sslcommerz/init`
- IPN (Instant Payment Notification) webhook: `POST /api/v1/payments/sslcommerz/ipn`
- Success/fail/cancel redirects
- Verify payment via SSLCommerz validation API

### 2. Deposit Management

**Deposit lifecycle per booking item:**
```
pending → collected → held → refunded/partially_refunded/forfeited
```

- `PATCH /api/v1/booking-items/:id/deposit/collect` — mark deposit collected
- `PATCH /api/v1/booking-items/:id/deposit/refund` — process refund (amount, method)
- `PATCH /api/v1/booking-items/:id/deposit/forfeit` — forfeit deposit (damage/loss)

### 3. Damage Report System

- `POST /api/v1/booking-items/:id/damage` — create damage report
- Fields: damage_level (enum), description, photos[], estimated_repair_cost
- Auto-calculate deduction from deposit
- If damage cost > deposit: record additional_charge
- Emit `damage.reported` event

### 4. Financial Calculations

All calculations use INTEGER math (ADR-04):
- Calculate subtotal (sum of item rental prices)
- Calculate total_fees (cleaning + backup + try-on)
- Calculate grand_total (subtotal + fees + shipping + deposit)
- Calculate balance_due (grand_total - total_paid)
- Calculate deposit_refund (deposit - deductions)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Payment recording API | Record manual payments |
| 2 | SSLCommerz integration | Init → IPN → verify |
| 3 | Deposit lifecycle API | Collect, refund, forfeit |
| 4 | Damage report API | Create report with photos |
| 5 | Financial calculation service | All math correct (integer) |
| 6 | Payment history query | List payments per booking |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Payment recording API | P14 (Owner booking detail — record payment) |
| SSLCommerz init API | P18 (Guest checkout — online payment) |
| Deposit management API | P14 (Owner booking — deposit actions) |
| Damage report API | P14 (Owner booking — damage claim form) |
| `payment.received` event | P10 (notifications) |
