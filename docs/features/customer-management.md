# Feature Spec: Customer Management

## Overview

Customer records are created automatically when a guest places a booking. There is no separate "customer registration" from the guest side — the system captures customer information during the checkout process and builds a profile over time.

Customers are **tenant-scoped** — a person who books from two different stores has two separate customer records (one per tenant).

---

## Customer Profile Data

### Captured at Checkout (Required)

| Field | Type | Required | Source |
|---|---|---|---|
| Full Name | Text | Yes | Checkout form |
| Phone Number | Text (BD format) | Yes | Checkout form |
| Alternative Phone | Text | No | Checkout form |
| Delivery Address | Text | Yes | Checkout form |
| Area | Text | Yes | Checkout form |
| Thana | Text | No | Checkout form |
| District | Text | Yes | Checkout form |

### Auto-Generated

| Field | Type | Source |
|---|---|---|
| Customer ID | UUID | System-generated |
| Created Date | Timestamp | First booking date |
| Last Booking Date | Timestamp | Most recent booking |
| Total Bookings | Number | Count of all orders |
| Total Spent | Number (৳) | Sum of all payments (excl. deposits) |
| Lifetime Deposit Held | Number (৳) | Total deposits currently held |

### Owner-Added (Optional)

| Field | Type | Description |
|---|---|---|
| Notes | Text | Internal notes about the customer |
| Tags | Multi-select | Custom tags (e.g., "VIP", "Frequent", "Difficult") |

---

## Customer Deduplication

### How Customers Are Identified

Primary identifier: **Phone number** (within the same tenant)

When a guest checks out:
1. System checks: Does a customer with this phone number already exist for this tenant?
2. **If yes**: Link the new booking to the existing customer record. Update name/address if changed.
3. **If no**: Create a new customer record.

### Why Phone Number?

- No account creation required — phone is always collected at checkout
- In Bangladesh, phone number is the most reliable identifier
- Same person won't have different phone numbers for the same store typically
- Email is not reliable (many Bangladeshi users don't use email regularly)

---

## Owner Portal — Customer List

### List View

Shows all customers who have ever booked from this store.

**Columns**:
| Column | Description |
|---|---|
| Name | Customer full name |
| Phone | Primary phone number |
| Total Bookings | Number of orders placed |
| Total Spent | Revenue from this customer (excl. deposits) |
| Last Booking | Date of most recent order |
| Status | Active / Has pending deposit / Has overdue return |

### Sorting
- Name (A-Z)
- Most bookings
- Highest spent
- Most recent booking
- Oldest customer

### Filtering
- Has active booking
- Has pending deposit
- Has overdue return
- By tag

### Search
- By name
- By phone number

---

## Owner Portal — Customer Detail Page

When owner clicks on a customer, show:

### Header Section
```
Fatima Rahman
📞 01712345678 (alt: 01812345679)
📍 Dhanmondi, Dhaka
Customer since: Jan 2026
```

### Stats Row
```
Total Bookings: 8 | Total Spent: ৳42,000 | Deposits Held: ৳5,000
```

### Booking History

Chronological list of all bookings:

```
#ORD-2026-0045 | March 20-22 | Royal Saree (White, M) | ৳7,500 | Completed ✅
#ORD-2026-0038 | Feb 14-16  | Evening Gown (Black, L) | ৳5,000 | Completed ✅
#ORD-2026-0012 | Jan 5-8    | Bridal Lehenga (Red, M) | ৳12,000 | Completed ✅
```

Each booking row is clickable → navigates to order detail.

### Notes Section
Owner can add/edit internal notes:
```
Notes: Regular customer. Prefers home delivery. Always returns on time.
```

### Tags
Owner can add/remove tags to categorize customers.

---

## Guest Side — No Account Required

Key principle: **Guests do not need accounts.**

- No registration page
- No login requirement to browse or book
- Customer profile is created implicitly during checkout
- Returning customers are identified by phone number

### Future Enhancement — Optional Guest Account

In a future version, guests can optionally create an account to:
- View their booking history
- Re-use saved delivery address
- Track active orders

But this is NOT part of v1. V1 is fully guest checkout — zero friction.

---

## Business Rules Summary

1. Customer records are per-tenant (isolated)
2. Customer created automatically at first checkout
3. Phone number is the unique identifier within a tenant
4. Repeat customers are matched by phone number
5. No forced account creation for guests
6. Owner can add notes and tags to customer records
7. Customer profile shows complete booking history and spend
8. Customer data is never shared across tenants
