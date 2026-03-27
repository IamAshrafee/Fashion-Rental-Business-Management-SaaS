# Feature Spec: Order Management

## Overview

Order management is the owner's day-to-day operational tool. After a guest places a booking, the owner manages its lifecycle through this section — confirming, shipping, tracking returns, inspecting products, and processing deposits.

For booking creation and lifecycle states, see [booking-system.md](./booking-system.md). This spec focuses on the **owner portal's order management UI and actions**.

---

## Order List View

### Default View

Shows all orders, most recent first.

**Columns**:
| Column | Description |
|---|---|
| Order ID | `#ORD-2026-0045` |
| Customer | Name + phone |
| Items | Product names (truncated if multiple) |
| Dates | Rental date range |
| Total | Grand total (including deposit) |
| Status | Current status with color badge |
| Created | When the order was placed |

### Status Badges (Color Coded)

| Status | Color | Icon |
|---|---|---|
| Pending | Yellow | ⏳ |
| Confirmed | Blue | ✓ |
| Shipped | Purple | 📦 |
| Delivered | Teal | ✅ |
| Overdue | Red | ⚠️ |
| Returned | Orange | ↩️ |
| Inspected | Cyan | 🔍 |
| Completed | Green | ✓✓ |
| Cancelled | Gray | ✕ |

### Filtering

| Filter | Options |
|---|---|
| Status | All, Pending, Confirmed, Shipped, Delivered, Overdue, Returned, Completed, Cancelled |
| Date Range | Today, This Week, This Month, Custom |
| Payment Status | All, Paid, Unpaid, Partial |

### Quick Actions (From List)

Actions available directly from the list without opening the order:

| Current Status | Quick Action |
|---|---|
| Pending | Confirm / Cancel |
| Confirmed | Mark as Shipped |
| Shipped | Mark as Delivered |
| Delivered | Mark as Returned |

---

## Order Detail View

### Header

```
Order #ORD-2026-0045
Status: ████ Confirmed
Placed: March 27, 2026 at 10:15 AM
```

### Customer Section

```
👤 Customer
   Fatima Rahman
   📞 01712345678 (alt: 01812345679)
   📍 House 12, Road 5, Dhanmondi, Dhaka
   📝 "Please deliver before 10 AM"
```

Click on customer name → navigate to customer detail page.

### Items Section

For each item in the order:

```
┌─────────────────────────────────────────────┐
│ [Image] Royal Banarasi Saree                │
│         Variant: White                      │
│         Size: M                             │
│         Dates: April 15 – April 17 (3 days) │
│                                             │
│         Rental:       ৳7,500                │
│         Deposit:      ৳5,000 (refundable)   │
│         Cleaning Fee: ৳500                  │
│         ────────────────                    │
│         Item Total:   ৳13,000               │
└─────────────────────────────────────────────┘
```

### Payment Section

```
💰 Payment
   Method: Cash on Delivery
   Status: Unpaid
   
   Rental + Fees:  ৳13,500
   Shipping:       ৳150
   Deposit:        ৳8,000
   ─────────────────
   Grand Total:    ৳21,650
   Paid:           ৳0
   Remaining:      ৳21,650
```

### Status Timeline

Visual timeline showing the order's journey:

```
📋 Order Timeline
─────────────────────────────────

⏳ Pending     March 27, 10:15 AM   Order placed by customer
✓  Confirmed   March 27, 11:00 AM   Confirmed by Owner
📦 Shipped     March 28, 2:00 PM    Shipped via Pathao (#TRACK123)
✅ Delivered   March 29, 10:00 AM   Delivery confirmed
↩️ Returned    April 18, 3:00 PM    Product returned
🔍 Inspected   April 18, 5:00 PM    No damage found
✓✓ Completed   April 18, 5:30 PM    Deposit refunded. Order complete.
```

Each timeline entry shows: status, timestamp, and note.

---

## Owner Actions Per Status

### When Status = Pending

| Action | Description |
|---|---|
| **Confirm** | Accept the booking. Sets status to Confirmed. |
| **Cancel** | Reject/cancel. Sets status to Cancelled. Requires reason. |
| **Call Customer** | Click-to-call customer phone number. |

### When Status = Confirmed

| Action | Description |
|---|---|
| **Mark as Shipped** | Record that product has been dispatched. Option to add tracking number/courier. |
| **Cancel** | Cancel before shipping. Reason required. |

### When Status = Shipped

| Action | Description |
|---|---|
| **Mark as Delivered** | Confirm product reached customer. |
| **Add Tracking Info** | Update courier tracking details. |

### When Status = Delivered

| Action | Description |
|---|---|
| **Mark as Returned** | Record that product has been returned. |
| **Extend Rental** | Customer requests more days. Add extended charges. |

### When Status = Overdue

| Action | Description |
|---|---|
| **Mark as Returned** | Product finally returned. System calculates late fees. |
| **Contact Customer** | Quick call/WhatsApp. |
| **View Late Fees** | See accumulated late fee amount. |

### When Status = Returned

| Action | Description |
|---|---|
| **Mark as Inspected** | Confirm product has been checked. |
| **Report Damage** | Flag damage. Opens damage assessment form. (See [damage-loss-handling.md](./damage-loss-handling.md)) |

### When Status = Inspected

| Action | Description |
|---|---|
| **Complete Order** | Finalize. Process deposit return. |
| **Adjust Charges** | Add late fees, damage charges, deductions before completing. |

---

## Payment Tracking

### Payment Status

| Status | Meaning |
|---|---|
| Unpaid | No payment received |
| Partial | Some payment received (e.g., advance bKash, remaining COD) |
| Paid | Full amount received |

### Recording Payments

Owner can manually record payments:
- "Record Payment" button
- Enter amount + method + reference
- Updates payment status accordingly

For gateway payments (SSLCommerz), payment is recorded automatically via webhook.

---

## Order Modification (Owner)

After confirmation, owner can make limited modifications:

| What | When | How |
|---|---|---|
| Add shipping fee | Before shipped | Edit order → add shipping amount |
| Adjust rental price | Before shipped | Edit order → change price (rare, for negotiation) |
| Add extended rental | After delivered | Add extra days + charges |
| Add late fee | After overdue | System calculates or owner enters manually |
| Add damage charge | After inspection | Linked to damage report |
| Adjust deposit refund | Before completing | Deduct damage/late fees from deposit |

All modifications are logged in the order timeline.

---

## Overdue Detection (Automated)

System runs a daily check (or on-demand):
1. Find all orders with status = Delivered
2. Where return date < today
3. Auto-transition status to Overdue
4. Notify owner (in-app notification)
5. Calculate accumulated late fees

Owner can still manually override (e.g., customer made return arrangements).

---

## Business Rules Summary

1. Orders are the owner's primary operational view
2. Status transitions follow strict rules (no skipping)
3. Every status change is logged in timeline with timestamp + note
4. Payment tracking is independent of order status
5. Owner can add charges (late fees, damage) before completing
6. Deposit refund amount = deposit - deductions (late fees + damage)
7. Overdue detection is automated
8. Order prices are snapshots — changes to product pricing don't affect existing orders
9. Quick actions from list view for common operations
