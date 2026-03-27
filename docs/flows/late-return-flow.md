# Flow: Late Return

## Overview

What happens when a customer doesn't return rented items on time — from detection through fee calculation to resolution.

---

## Flow Diagram

```
[Rental Period Ends (end_date reached)]
       │
       ▼
[CRON: Daily Overdue Check (10 AM)]
       │
       ├── Query: bookings WHERE status = "delivered" AND end_date < today
       │
       ├── Found overdue items?
       │   ├── No → skip
       │   └── Yes ──────────────┐
       │                         │
       ▼                         ▼
                          [Mark OVERDUE]
                                 │
                                 ├── booking.status → "overdue"
                                 ├── Calculate current late days
                                 │
                                 ├── Owner in-app notification (high priority)
                                 ├── Customer SMS (Day 1 only):
                                 │   "Your rental return for [Product] is overdue.
                                 │    Please return ASAP. Late fee: ৳300/day"
                                 │
                                 ▼
                          [Daily Late Fee Accumulation]
                                 │
                                 ├── Each day overdue:
                                 │   lateDays++
                                 │   lateFee += lateFeeAmount
                                 │                or
                                 │   lateFee += retailPrice × lateFeePercentage
                                 │
                                 ├── Cap at maxLateFee (if set)
                                 │
                                 ▼
                          [Customer Returns Item]
                                 │
                                 ├── Owner clicks "Mark Returned"
                                 ├── Final lateDays and lateFee calculated
                                 ├── booking.status → "returned"
                                 │
                                 ▼
                          [Inspection & Resolution]
                                 │
                                 ├── Late fee recorded on BookingItem
                                 ├── Late fee can be:
                                 │   ├── Deducted from deposit
                                 │   ├── Added to outstanding balance
                                 │   └── Waived by owner (manual override)
                                 │
                                 ▼
                          [Complete Order]
```

---

## Late Fee Calculation

### Fixed Rate

```
lateFee = lateDays × lateFeeAmount
if (maxLateFee && lateFee > maxLateFee) lateFee = maxLateFee
```

### Percentage Rate

```
dailyFee = retailPrice × (lateFeePercentage / 100)
lateFee = lateDays × dailyFee
if (maxLateFee && lateFee > maxLateFee) lateFee = maxLateFee
```

### Example

| Setting | Value |
|---|---|
| Late fee type | Fixed |
| Late fee/day | ৳300 |
| Max late fee | ৳2,000 |
| Days late | 5 |

```
Uncapped: 5 × 300 = ৳1,500
Capped: min(1500, 2000) = ৳1,500 (under cap)
```

If 10 days late: `10 × 300 = ৳3,000 → capped at ৳2,000`

---

## Communication Timeline

| Day | Action |
|---|---|
| Day 0 (due date) | Return reminder SMS sent (via daily CRON at 9 AM) |
| Day 1 overdue | Status → Overdue. SMS: "Your return is overdue. Late fee applies." |
| Day 2-7 | No additional SMS (avoid harassment). In-app notification to owner daily. |
| Day 7+ | Owner contacts customer directly via phone/WhatsApp |

---

## Owner Actions

| Action | Description |
|---|---|
| Contact Customer | Click phone/WhatsApp to reach customer |
| Waive Fee | Owner can set lateFee = 0 (goodwill gesture) |
| Adjust Fee | Owner can manually set lateFee to any amount |
| Escalate | No automated escalation — owner handles directly |
