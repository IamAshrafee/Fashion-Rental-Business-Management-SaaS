# Database Schema: `payments`

## Table: `payments`

Records every payment transaction for a booking.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `booking_id` | UUID | No | — | FK → `bookings.id` |
| `amount` | INTEGER | No | — | Payment amount |
| `method` | ENUM | No | — | cod, bkash, nagad, sslcommerz |
| `status` | ENUM | No | `'pending'` | pending, verified, failed, refunded |
| `transaction_id` | VARCHAR(255) | Yes | `NULL` | External reference ID |
| `provider_response` | JSONB | Yes | `NULL` | Raw gateway response |
| `verified_at` | TIMESTAMP | Yes | `NULL` | When verified |
| `refunded_at` | TIMESTAMP | Yes | `NULL` | When refunded |
| `refund_amount` | INTEGER | Yes | `NULL` | Refund amount |
| `notes` | TEXT | Yes | `NULL` | Payment notes |
| `recorded_by` | UUID | Yes | `NULL` | FK → `users.id` (who recorded) |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum TransactionStatus {
  pending
  verified
  failed
  refunded
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `payments_booking_id_idx` | `booking_id` | INDEX |
| `payments_tenant_id_idx` | `tenant_id` | INDEX |
| `payments_transaction_id_idx` | `transaction_id` | INDEX |

---

## Prisma Model

```prisma
model Payment {
  id               String            @id @default(uuid())
  tenantId         String            @map("tenant_id")
  bookingId        String            @map("booking_id")
  amount           Int           @db.Int(12, 2)
  method           PaymentMethod
  status           TransactionStatus @default(pending)
  transactionId    String?           @map("transaction_id")
  providerResponse Json?             @map("provider_response")
  verifiedAt       DateTime?         @map("verified_at")
  refundedAt       DateTime?         @map("refunded_at")
  refundAmount     Int?          @map("refund_amount") @db.Int(12, 2)
  notes            String?
  recordedBy       String?           @map("recorded_by")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  booking          Booking           @relation(fields: [bookingId], references: [id])

  @@index([bookingId])
  @@index([tenantId])
  @@index([transactionId])
  @@map("payments")
}
```

---

## Notes

- Multiple payment records per booking supported (partial payments)
- `provider_response` stores raw JSON from SSLCommerz IPN for audit
- `recorded_by` tracks which staff member recorded a manual payment
