# API Design: Notification Module

## Owner Endpoints

---

### GET `/api/v1/owner/notifications`

List notifications for the current user.

**Auth**: Bearer token — Owner, Manager, Staff

**Query Params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `unreadOnly` | boolean | false | Only unread |
| `page` | int | 1 | Page |
| `limit` | int | 20 | Per page |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "type": "new_booking",
      "title": "New booking from Fatima Rahman",
      "message": "Royal Saree (White, M) · ৳13,000",
      "data": { "bookingId": "...", "bookingNumber": "#ORD-2026-0045" },
      "isRead": false,
      "createdAt": "2026-04-15T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 35, "unreadCount": 3 }
}
```

---

### GET `/api/v1/owner/notifications/unread-count`

Quick count for the notification badge.

**Auth**: Bearer token

**Response** `200`:
```json
{
  "success": true,
  "data": { "unreadCount": 3 }
}
```

---

### PATCH `/api/v1/owner/notifications/:id/read`

Mark a single notification as read.

**Auth**: Bearer token

**Response** `200`:
```json
{
  "success": true,
  "data": { "id": "...", "isRead": true }
}
```

---

### PATCH `/api/v1/owner/notifications/read-all`

Mark all notifications as read.

**Auth**: Bearer token

**Response** `200`:
```json
{
  "success": true,
  "data": { "markedCount": 3 }
}
```

---

### DELETE `/api/v1/owner/notifications/:id`

Dismiss a single notification.

**Auth**: Bearer token

---

## Internal / System Endpoints

These are not exposed via REST — they are internal service methods called by other modules.

### NotificationService.sendBookingNotification(bookingId)

Triggered by: Booking module on new booking

Actions:
1. Create in-app notification for owner
2. Send SMS to owner (if configured)

### NotificationService.sendStatusUpdateSMS(bookingId, newStatus)

Triggered by: Booking module on status change

Actions:
1. Create in-app notification
2. Send SMS to customer (if status-specific SMS is enabled)

### NotificationService.sendReturnReminders()

Triggered by: Daily CRON job

Actions:
1. Find orders with return due tomorrow
2. SMS customer: return reminder
3. In-app notification: owner

### NotificationService.detectOverdue()

Triggered by: Daily CRON job

Actions:
1. Find delivered orders past return date
2. Update status to Overdue
3. In-app notification: owner (high priority)
4. SMS customer (first day only)
