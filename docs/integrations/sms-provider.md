# Integration: SMS Provider

## Overview

SMS is the primary customer communication channel. Used for booking notifications, status updates, OTP, and return reminders.

---

## Provider Options (Bangladesh)

| Provider | API | Cost Estimate |
|---|---|---|
| **BulkSMSBD** | REST API | ~৳0.25/SMS |
| **SMSQ** | REST API | ~৳0.25/SMS |
| **Infobip** | REST API | ~৳0.50/SMS |
| **Twilio** | REST API | ~৳1.50/SMS (international routing) |

**Recommended**: BulkSMSBD or SMSQ for cost efficiency with BD numbers.

---

## Adapter Interface

```typescript
interface SMSProvider {
  sendSMS(to: string, message: string): Promise<SMSResult>;
  getBalance(): Promise<number>;
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}

interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed';
  cost: number;
}
```

---

## SMS Templates

### Owner Notifications

| Event | Template |
|---|---|
| New Booking | `নতুন অর্ডার! #{number} - {customer} - ৳{total}. ClosetRent-এ দেখুন।` |
| Overdue Alert | `⚠ #{number} ফেরত দেওয়ার তারিখ পার হয়ে গেছে। অবিলম্বে যোগাযোগ করুন।` |

### Customer Notifications

| Event | Template |
|---|---|
| Booking Confirmed | `আপনার অর্ডার #{number} নিশ্চিত হয়েছে। {store} থেকে শীঘ্রই ডেলিভারি পাবেন।` |
| Shipped | `আপনার অর্ডার #{number} পাঠানো হয়েছে। ট্র্যাক: {tracking}` |
| Return Reminder | `অনুগ্রহ করে আগামীকাল #{number} ফেরত দিন। ৳{lateFee}/দিন বিলম্ব ফি প্রযোজ্য।` |
| Overdue | `আপনার ভাড়ার ফেরত দেওয়ার তারিখ পার হয়ে গেছে। অনুগ্রহ করে যত দ্রুত সম্ভব ফেরত দিন। #{number}` |
| Completed | `অর্ডার #{number} সম্পন্ন! {store}-এ আবারো ভাড়া নিন। ধন্যবাদ!` |

Templates support both Bengali and English (based on store setting).

---

## Rate Limiting & Queuing

```
SMS Request → Redis Queue → Worker → SMS Provider API
                   │
                   ├── Dedup: same phone + same template within 5 min → skip
                   ├── Rate: max 10 SMS/second to provider
                   └── Retry: 3 attempts with exponential backoff
```

---

## Configuration (Platform-Level)

```env
SMS_PROVIDER=bulksmbd
SMS_API_KEY=xxx
SMS_SENDER_ID=ClosetRent
SMS_RATE_LIMIT=10        # messages per second
```

---

## Cost Tracking

Log every SMS sent:

```
sms_logs {
  id, tenant_id, recipient, template, status, cost, provider_message_id, created_at
}
```

Monthly SMS usage reported per tenant for potential billing.
