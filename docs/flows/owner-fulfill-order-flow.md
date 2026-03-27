# Flow: Owner Fulfill Order

## Overview

The complete lifecycle of an order from the owner's perspective — from receiving a new booking to completing the order after return and inspection.

---

## Flow Diagram

```
[New Booking Received]
       │
       ├── 🔔 SMS notification to owner
       ├── 🔔 In-app notification (bell icon + pending count)
       ├── Booking appears in "Pending" tab
       │
       ▼
[Review Booking]
       │
       ├── Check items, dates, customer info
       ├── Verify product availability (visual calendar check)
       │
       ├──[Confirm] ──────────────────────────────┐
       │                                           │
       ├──[Cancel] ────────────────────┐           │
       │                               │           │
       ▼                               ▼           ▼
[CANCELLED]                      [CONFIRMED]
       │                               │
       ├── Release date blocks         ├── DateBlocks: pending → booking
       ├── SMS customer: cancelled     ├── SMS customer: confirmed
       └── Done                        │
                                       ▼
                                [Prepare for Shipping]
                                       │
                                       ├── Pack items
                                       ├── Select courier (Pathao/Steadfast/Manual)
                                       │
                                       ├── [useCourierApi = true]
                                       │     ├── POST courier API → create parcel
                                       │     └── Auto-fill tracking number
                                       ├── [useCourierApi = false]
                                       │     └── Owner enters tracking number manually
                                       │
                                       ▼
                                [SHIPPED]
                                       │
                                       ├── SMS customer: shipped + tracking
                                       │
                                       ▼
                                [DELIVERED]
                                       │
                                       ├── Rental period starts
                                       ├── Start return countdown
                                       │
                                       ├── Return on time? ──────────[Yes]───┐
                                       │                                     │
                                       ├── Return overdue? ──[Yes]──┐        │
                                       │                            │        │
                                       ▼                            ▼        ▼
                                                            [OVERDUE]   [RETURNED]
                                                                   │        │
                                                                   │   ┌────┘
                                                                   │   │
                                                                   ├── Late fee calculated
                                                                   ├── SMS customer: overdue
                                                                   │
                                                                   ▼
                                                            [RETURNED]
                                                                   │
                                                                   ▼
                                                            [INSPECTED]
                                                                   │
                                                                   ├── Check each item condition
                                                                   ├── Report damage if any
                                                                   │   └── See damage-claim-flow.md
                                                                   ├── Process deposit refund
                                                                   │   └── See deposit-refund-flow.md
                                                                   │
                                                                   ▼
                                                            [COMPLETED]
                                                                   │
                                                                   ├── SMS customer: completed
                                                                   ├── Update customer stats
                                                                   ├── Update product booking count
                                                                   └── Done
```

---

## Status Transition Matrix

| From | To | Trigger | Side Effects |
|---|---|---|---|
| Pending | Confirmed | Owner clicks Confirm | Date blocks → booking type, SMS |
| Pending | Cancelled | Owner or guest cancels | Release date blocks, SMS |
| Confirmed | Shipped | Owner ships order | Tracking saved, SMS |
| Confirmed | Cancelled | Owner cancels | Release date blocks, SMS |
| Shipped | Delivered | Owner marks delivered | Start return countdown |
| Delivered | Returned | Owner marks returned | — |
| Delivered | Overdue | CRON detects past due | Late fee starts, SMS |
| Overdue | Returned | Owner marks returned | Final late fee recorded |
| Returned | Inspected | Owner inspects items | Damage report if needed |
| Inspected | Completed | Owner completes order | Deposit refunded, stats updated |

---

## Automated CRON Jobs

| Job | Schedule | Action |
|---|---|---|
| Return reminders | Daily 9 AM | SMS customers with return due tomorrow |
| Overdue detection | Daily 10 AM | Find delivered orders past return date → mark Overdue → SMS |
| Booking expiry | Every 30 min | Pending bookings older than 24h → auto-cancel (future feature) |

---

## Audit Trail

Every status change is logged to `audit_logs` with:
- Who performed the action (owner/staff user_id)
- Previous status → new status
- Timestamp
- IP address
