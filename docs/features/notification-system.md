# Feature Spec: Notification System

## Overview

Notifications keep both business owners and customers informed at every important step. The system supports SMS (primary channel for Bangladesh) and in-app notifications (for the owner portal).

---

## Notification Channels

| Channel | Audience | Use Case |
|---|---|---|
| **SMS** | Customers + Owners | Critical events: booking confirmation, shipping, return reminders |
| **In-App** | Owners (in dashboard) | All events: new bookings, status changes, overdue alerts |
| **WhatsApp** (future) | Customers | Rich notifications with images |
| **Email** (future) | Customers + Owners | Order receipts, summaries |

### Priority for v1
1. **SMS** — most important for Bangladesh market
2. **In-App** — essential for owner dashboard

---

## SMS Notifications

### Customer SMS Messages

| Trigger | Message Template |
|---|---|
| Booking placed | "Your booking #ORD-2026-0045 has been placed! We'll confirm shortly. — {StoreName}" |
| Booking confirmed | "Good news! Your booking #ORD-2026-0045 is confirmed. Delivery by {date}. — {StoreName}" |
| Booking cancelled | "Your booking #ORD-2026-0045 has been cancelled. Contact us for questions: {phone}. — {StoreName}" |
| Product shipped | "Your order #ORD-2026-0045 has been shipped! Track: {trackingLink}. — {StoreName}" |
| Return reminder (1 day before) | "Reminder: Please return your rental by tomorrow ({returnDate}). Late fee: ৳{lateFee}/day. — {StoreName}" |
| Return due today | "Your rental is due for return today ({returnDate}). Late returns will be charged. — {StoreName}" |
| Booking completed | "Thank you! Your rental is complete and deposit of ৳{depositAmount} will be refunded. — {StoreName}" |

### Owner SMS Messages

| Trigger | Message Template |
|---|---|
| New booking received | "New booking #ORD-2026-0045 from {customerName}. ৳{totalAmount}. Review in your dashboard." |

### SMS Configuration (Owner Settings)

Owner can toggle individual SMS notifications on/off:

```
📱 SMS Notifications

Customer Notifications:
  ✅ Booking confirmation
  ✅ Shipping update
  ✅ Return reminder
  ✅ Completion notice
  ☐ Promotional messages (future)

Owner Notifications:
  ✅ New booking alert
  ✅ Overdue alert
```

---

## In-App Notifications (Owner Portal)

### Notification Bell

- Located in the owner portal header (top-right)
- Shows unread count badge (red dot with number)
- Clicking opens notification dropdown/panel

### Notification Types

| Type | Icon | Priority | Example |
|---|---|---|---|
| New Booking | 📋 | High | "New booking from Fatima Rahman — ৳13,000" |
| Booking Cancelled | ✕ | Medium | "Booking #ORD-2026-0045 cancelled by customer" |
| Payment Received | 💰 | High | "Payment of ৳13,000 received for #ORD-2026-0045" |
| Return Due Tomorrow | ⏰ | Medium | "Royal Saree due for return tomorrow (Fatima Rahman)" |
| Order Overdue | ⚠️ | High | "OVERDUE: Royal Saree not returned. Due date was April 17." |
| Product Review (future) | ⭐ | Low | "New 5-star review on Royal Saree" |

### Notification Panel Layout

```
🔔 Notifications (3 unread)

──── Today ────
📋 New booking from Fatima Rahman          2 min ago
   Royal Saree (White, M) · ৳13,000       [View Order]

⚠️ OVERDUE: Evening Gown not returned      1 hour ago
   Customer: Anika Hasan · Due: April 17   [View Order]

──── Yesterday ────
💰 Payment received for #ORD-2026-0042     Yesterday
   ৳8,500 via bKash                        [View Order]
```

### Notification Actions
- Click on notification → navigate to the relevant order
- "Mark all as read" button
- Individual dismiss (swipe or X button)

### Notification Persistence
- Stored in database (per tenant)
- Retained for 30 days
- Older notifications auto-deleted

---

## Automated Notifications (System-Triggered)

### Return Reminder System

Daily automated job runs at a configured time (e.g., 9 AM Bangladesh time):

1. Find all orders where status = Delivered AND returnDate = tomorrow
2. Send SMS to customer: return reminder
3. Create in-app notification for owner

### Overdue Detection

Daily automated job:

1. Find all orders where status = Delivered AND returnDate < today
2. Update status to Overdue
3. Send in-app notification to owner (high priority)
4. First overdue day: Send SMS to customer

---

## SMS Gateway Integration

### Architecture

```
Notification Service → SMS Provider API → Customer Phone
```

### Provider Selection

Use a Bangladeshi SMS gateway that supports:
- Bulk SMS
- API-based sending
- Delivery reports
- Unicode (Bengali text support)
- Reasonable pricing

Common providers: BulkSMS BD, SSL Wireless, Teletalk SMS API

### Configuration

Each tenant can have their own SMS configuration (future) or share platform-level SMS credentials (v1).

### SMS Costs

SMS costs will be:
- Absorbed by the SaaS platform (included in subscription fee), OR
- Passed through to tenants (per-SMS billing)

Decision deferred. For v1, platform absorbs costs (limited volume).

---

## Business Rules Summary

1. SMS is the primary notification channel for Bangladesh
2. In-app notifications for owner portal only
3. Customer notifications are SMS-based (no in-app for guests in v1)
4. Owner can toggle individual notification types on/off
5. Return reminders sent automatically 1 day before and on the due date
6. Overdue detection runs daily and auto-notifies
7. All notifications are tenant-scoped
8. Notification history retained for 30 days
9. SMS templates include store name for branding
