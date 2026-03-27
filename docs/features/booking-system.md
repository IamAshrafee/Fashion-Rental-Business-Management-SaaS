# Feature Spec: Booking System

## Overview

A booking is the primary transaction in the system. It represents a customer's reservation to rent one or more products for a specific date range. Bookings are created through the checkout flow and then managed by the business owner through their portal.

This spec covers the booking entity, lifecycle, and rules. For availability checking, see [availability-engine.md](./availability-engine.md). For the checkout UI, see [checkout-flow.md](./checkout-flow.md).

---

## Booking vs. Order — Terminology

In this system, **Booking** and **Order** are used to describe different stages of the same transaction:

| Term | When | Description |
|---|---|---|
| **Booking** | Customer submits checkout | The initial reservation request |
| **Order** | Owner confirms booking | The confirmed, in-progress transaction |

Technically, both are the same database record, just at different statuses. The term "Order" is more commonly used in the owner portal, and "Booking" on the guest side.

---

## Booking Data

### Core Fields

| Field | Type | Source |
|---|---|---|
| Booking ID | String (formatted) | Auto-generated (e.g., `#ORD-2026-0045`) |
| Tenant ID | UUID | From tenant context |
| Customer ID | UUID | From checkout (matched or created by phone) |
| Status | Enum | Lifecycle status |
| Created At | Timestamp | When booking was placed |
| Updated At | Timestamp | Last status change |

### Booking Items

A booking can contain **one or more items** (products).

Each booking item:

| Field | Type | Description |
|---|---|---|
| Product ID | UUID | The rented product |
| Variant ID | UUID | Selected color variant |
| Size | String/Object | Selected size (mode-dependent) |
| Start Date | Date | Rental start date (pickup/delivery) |
| End Date | Date | Rental return date |
| Rental Days | Number | Calculated: end - start + 1 |
| Rental Price | Number (৳) | Base rental cost for this item |
| Extended Days | Number | Extra days beyond base duration |
| Extended Cost | Number (৳) | Extended rental charge |
| Deposit Amount | Number (৳) | Security deposit for this item |
| Cleaning Fee | Number (৳) | Cleaning fee for this item |
| Backup Size Fee | Number (৳) | Backup size charge (if selected) |
| Backup Size | String | The backup size selected (if any) |
| Try-On Fee | Number (৳) | Try-on fee (if selected) |
| Item Total | Number (৳) | Sum of all charges for this item |

### Booking-Level Fields

| Field | Type | Description |
|---|---|---|
| Subtotal | Number (৳) | Sum of all item totals |
| Shipping Fee | Number (৳) | Delivery charge |
| Total Amount | Number (৳) | Subtotal + Shipping |
| Total Deposit | Number (৳) | Sum of all item deposits |
| Grand Total | Number (৳) | Total Amount + Total Deposit |
| Payment Method | Enum | COD / bKash / Nagad / Card / Bank |
| Payment Status | Enum | Unpaid / Partial / Paid |
| Delivery Address | Object | Full address from checkout |
| Customer Name | String | Snapshot from checkout |
| Customer Phone | String | Snapshot from checkout |
| Notes | Text | Customer's special instructions (optional) |

---

## Booking Lifecycle (Status Flow)

```
         Guest places order
               │
               ▼
          ┌─────────┐
          │ PENDING  │  ← Owner has not reviewed yet
          └────┬─────┘
               │
        Owner reviews
        ┌──────┴──────┐
        ▼             ▼
  ┌──────────┐  ┌───────────┐
  │CONFIRMED │  │ CANCELLED │  ← Owner rejects or Guest cancels
  └────┬─────┘  └───────────┘
       │
  Owner ships
       │
       ▼
  ┌──────────┐
  │ SHIPPED  │  ← Product dispatched
  └────┬─────┘
       │
  Customer receives
       │
       ▼
  ┌──────────┐
  │DELIVERED │  ← Product in customer's hands
  └────┬─────┘
       │
       ├──── Return date passes without return ──→ ┌─────────┐
       │                                           │ OVERDUE  │
       │                                           └────┬─────┘
       │                                                │
       │◄───────────────── Customer returns ────────────┘
       │
       ▼
  ┌──────────┐
  │ RETURNED │  ← Product back with owner
  └────┬─────┘
       │
  Owner inspects
       │
       ▼
  ┌───────────┐
  │ INSPECTED │  ← Owner checks for damage
  └────┬──────┘
       │
  Deposit processed
       │
       ▼
  ┌───────────┐
  │ COMPLETED │  ← Rental cycle fully done
  └───────────┘
```

### Status Definitions

| Status | Who Triggers | What Happens |
|---|---|---|
| **Pending** | System (on checkout) | Booking created, waiting for owner review |
| **Confirmed** | Owner | Owner accepts the booking |
| **Cancelled** | Owner or Guest | Booking cancelled (before shipping) |
| **Shipped** | Owner | Product dispatched to customer |
| **Delivered** | Owner | Confirms product reached customer |
| **Overdue** | System (auto) | Return date passed, product not returned |
| **Returned** | Owner | Product returned by customer |
| **Inspected** | Owner | Product checked for damage |
| **Completed** | Owner | Deposit refunded, cycle fully closed |

### Status Transition Rules

| From | Allowed Next Status |
|---|---|
| Pending | Confirmed, Cancelled |
| Confirmed | Shipped, Cancelled |
| Shipped | Delivered, Cancelled (rare) |
| Delivered | Returned, Overdue |
| Overdue | Returned |
| Returned | Inspected |
| Inspected | Completed |
| Cancelled | — (terminal state) |
| Completed | — (terminal state) |

---

## Booking ID Format

Format: `#ORD-{YEAR}-{SEQUENCE}`

Example: `#ORD-2026-0045`

- Year: Current year
- Sequence: Auto-incrementing per tenant, resets yearly
- Padded to 4 digits (up to 9999 per year per tenant)

---

## Cancellation Rules

### Guest Can Cancel
- Only when status is **Pending** (before owner confirms)
- No cancellation fee in v1
- Future: Configurable cancellation policy per tenant

### Owner Can Cancel
- At **Pending** or **Confirmed** status
- Must provide a cancellation reason
- If payment was already made → refund process triggered

### Cannot Cancel After Shipped
- Once shipped, cancellation is not allowed through the system
- Owner must handle manually (return → refund)

---

## Booking Notifications

| Event | Who Gets Notified | Channel |
|---|---|---|
| New booking placed | Owner | In-app notification, SMS (configurable) |
| Booking confirmed | Customer | SMS |
| Booking cancelled | Customer + Owner | SMS + In-app |
| Product shipped | Customer | SMS |
| Return date reminder (1 day before) | Customer | SMS |
| Order overdue | Owner | In-app notification |
| Booking completed | Customer | SMS |

---

## Price Snapshot

When a booking is created, all prices are **snapshotted** at the time of booking:

- Rental price at time of booking is stored
- Deposit amount at time of booking is stored
- Cleaning fee at time of booking is stored
- Even if the owner changes the product pricing later, existing bookings keep their original prices

This prevents price disputes.

---

## Business Rules Summary

1. One booking can contain multiple items (products)
2. Each item has its own date range (different products can have different rental dates)
3. All prices are snapshotted at booking time
4. Booking ID is formatted and human-readable
5. Status follows a strict flow — no skipping steps
6. Overdue status is auto-triggered by the system
7. Cancellation is only possible before shipping
8. Guest does not need an account to create a booking
9. Notifications sent at each major status change
