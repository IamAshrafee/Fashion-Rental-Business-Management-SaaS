# Database Schema: `reviews`

## Table: `reviews`

Customer reviews for products. Future feature — included in schema for forward compatibility.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `customer_id` | UUID | No | — | FK → `customers.id` |
| `booking_id` | UUID | No | — | FK → `bookings.id` |
| `rating` | INT | No | — | 1-5 star rating |
| `comment` | TEXT | Yes | `NULL` | Review text |
| `is_visible` | BOOLEAN | No | `true` | Owner can hide inappropriate reviews |
| `created_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `reviews_product_id_idx` | `product_id` | INDEX |
| `reviews_customer_id_idx` | `customer_id` | INDEX |
| `reviews_tenant_id_idx` | `tenant_id` | INDEX |
| `reviews_booking_product_key` | `booking_id, product_id` | UNIQUE |

### Constraints

- `rating` CHECK: `rating >= 1 AND rating <= 5`
- One review per booking-product combination

---

## Prisma Model

```prisma
model Review {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  productId  String   @map("product_id")
  customerId String   @map("customer_id")
  bookingId  String   @map("booking_id")
  rating     Int
  comment    String?
  isVisible  Boolean  @default(true) @map("is_visible")
  createdAt  DateTime @default(now()) @map("created_at")

  product    Product  @relation(fields: [productId], references: [id])
  customer   Customer @relation(fields: [customerId], references: [id])
  booking    Booking  @relation(fields: [bookingId], references: [id])

  @@unique([bookingId, productId])
  @@index([productId])
  @@index([tenantId])
  @@map("reviews")
}
```
