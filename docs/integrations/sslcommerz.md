# Integration: SSLCommerz Payment Gateway

## Overview

SSLCommerz is Bangladesh's leading online payment gateway, supporting cards, mobile banking, and net banking. Used for automated online payments.

**Available to**: Pro plan tenants (requires merchant account).

---

## Integration Flow

```
[Guest selects "Online Payment"]
       │
       ▼
[Server: POST to SSLCommerz /gwprocess/v4/api.php]
       │
       ├── Payload: amount, currency, customer info, URLs
       ├── Response: GatewayPageURL
       │
       ▼
[Guest redirected to SSLCommerz gateway]
       │
       ├── Guest selects: bKash / card / bank
       ├── Completes payment
       │
       ├── Success → redirect to success_url
       ├── Fail → redirect to fail_url
       ├── Cancel → redirect to cancel_url
       │
       ▼
[IPN Callback → POST /payments/sslcommerz/ipn]
       │
       ├── Validate: IP whitelist (SSLCommerz IPs)
       ├── Validate: Hash signature
       ├── Validate: tran_id matches pending booking
       ├── Validate: amount matches expected
       ├── Validate: status = "VALID"
       │
       ├── All valid:
       │   ├── Create Payment record
       │   ├── Create Booking (if not yet created)
       │   ├── paymentStatus → "paid"
       │   └── SMS: "Payment confirmed"
       │
       └── Invalid:
           ├── Log the attempt
           └── Do NOT create booking
```

---

## Configuration (Per-Tenant)

```json
{
  "paymentMethods": {
    "sslcommerz": {
      "enabled": true,
      "storeId": "store_xxxxx",
      "storePassword": "store_xxxxx@ssl",
      "isLive": true
    }
  }
}
```

---

## API Endpoints Used

| SSLCommerz API | Purpose |
|---|---|
| `POST /gwprocess/v4/api.php` | Initiate payment session |
| `GET /validator/api/validationserverAPI.php` | Server-side validation |
| `GET /validator/api/merchantTransIDvalidationAPI.php` | Transaction ID lookup |

---

## Request Payload

```json
{
  "store_id": "store_xxxxx",
  "store_passwd": "store_xxxxx@ssl",
  "total_amount": 22700,
  "currency": "BDT",
  "tran_id": "BOOKING-{uuid}",
  "success_url": "https://{subdomain}/api/v1/payments/sslcommerz/success",
  "fail_url": "https://{subdomain}/api/v1/payments/sslcommerz/fail",
  "cancel_url": "https://{subdomain}/api/v1/payments/sslcommerz/cancel",
  "ipn_url": "https://api.closetrent.com.bd/payments/sslcommerz/ipn",
  "cus_name": "Fatima Rahman",
  "cus_phone": "01712345678",
  "cus_email": "N/A",
  "cus_add1": "Dhanmondi, Dhaka",
  "shipping_method": "NO",
  "product_name": "Fashion Rental Booking",
  "product_category": "Rental",
  "product_profile": "non-physical-goods"
}
```

---

## Security

| Check | Implementation |
|---|---|
| IP Whitelist | Only accept IPN from SSLCommerz IP ranges |
| Hash Verification | Verify `verify_sign` with store password |
| Idempotency | Track `tran_id` to prevent double processing |
| Amount Verification | Compare IPN amount with expected booking total |
| HTTPS only | All URLs must be HTTPS |

---

## Testing

- **Sandbox**: `sandbox.sslcommerz.com` with test credentials
- Test card: `4111111111111111`
- All sandbox transactions are free
