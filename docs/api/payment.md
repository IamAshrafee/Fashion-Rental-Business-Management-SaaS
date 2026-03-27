# API Design: Payment Module

## Guest Endpoints

---

### POST `/api/v1/payments/initiate`

Initiate an online payment (SSLCommerz).

**Auth**: None (called during checkout)

**Request Body**:
```json
{
  "bookingId": "...",
  "method": "sslcommerz",
  "amount": 13650
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://securepay.sslcommerz.com/...",
    "sessionKey": "..."
  }
}
```

Redirects customer to payment gateway.

---

### POST `/api/v1/payments/sslcommerz/ipn`

SSLCommerz IPN (Instant Payment Notification) webhook.

**Auth**: SSLCommerz server IP verification

Called server-to-server by SSLCommerz after payment completion.

**Request Body**: SSLCommerz IPN payload (form-encoded)

**Processing**:
1. Verify IPN signature
2. Match to booking via `tran_id`
3. Create payment record
4. Update booking payment status
5. Send SMS confirmation

**Response** `200`: Simple acknowledgment

---

### GET `/api/v1/payments/sslcommerz/success`

Success redirect URL — customer lands here after successful payment.

**Auth**: None

Redirects to booking confirmation page with booking number.

---

### GET `/api/v1/payments/sslcommerz/fail`

Failure redirect URL.

Redirects to checkout with error message.

---

### GET `/api/v1/payments/sslcommerz/cancel`

Cancellation redirect URL.

Redirects to cart page.

---

## Owner Endpoints

---

### POST `/api/v1/owner/bookings/:id/payments`

Manually record a payment (COD, manual bKash/Nagad).

**Auth**: Bearer token — Owner, Manager

**Request Body**:
```json
{
  "amount": 13650,
  "method": "bkash",
  "transactionId": "TXN123456",
  "notes": "Verified via bKash app"
}
```

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "paymentId": "...",
    "amount": 13650,
    "method": "bkash",
    "status": "verified",
    "transactionId": "TXN123456",
    "recordedBy": "Hana Rahman",
    "createdAt": "2026-04-15T10:30:00Z"
  }
}
```

Automatically updates booking `payment_status` (unpaid → partial → paid).

---

### GET `/api/v1/owner/bookings/:id/payments`

List all payments for a booking.

**Auth**: Bearer token — Owner, Manager, Staff

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "amount": 8000,
      "method": "bkash",
      "status": "verified",
      "transactionId": "TXN123456",
      "createdAt": "2026-04-15T10:30:00Z"
    },
    {
      "id": "...",
      "amount": 5650,
      "method": "cod",
      "status": "verified",
      "createdAt": "2026-04-17T12:00:00Z"
    }
  ],
  "summary": {
    "totalDue": 13650,
    "totalPaid": 13650,
    "balance": 0,
    "paymentStatus": "paid"
  }
}
```
