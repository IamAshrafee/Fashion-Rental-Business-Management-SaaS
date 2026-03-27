# Database Schema — Overview

## Conventions

All tables follow these conventions:

| Convention | Detail |
|---|---|
| **Naming** | `snake_case` for table and column names |
| **Primary Key** | `id` — UUID v4, auto-generated |
| **Tenant Scoping** | `tenant_id` column on all tenant-scoped tables |
| **Timestamps** | `created_at` and `updated_at` on every table |
| **Soft Delete** | `deleted_at` nullable timestamp (where applicable) |
| **ORM** | Prisma — models defined in `schema.prisma` |
| **Database** | PostgreSQL 16 |
| **Indexes** | Documented per table. All `tenant_id` columns indexed. |
| **Enums** | Defined as PostgreSQL enums via Prisma |

---

## Entity Relationship Diagram (Simplified)

```
┌──────────┐     ┌──────────┐     ┌───────────┐
│  Tenant  │────<│   User   │     │  Customer  │
└────┬─────┘     └──────────┘     └──────┬─────┘
     │                                    │
     │  ┌──────────────┐                  │
     ├──│   Category   │                  │
     │  └──────┬───────┘                  │
     │         │                          │
     │  ┌──────┴───────┐                  │
     │  │ Subcategory  │                  │
     │  └──────────────┘                  │
     │                                    │
     │  ┌──────────┐    ┌────────────┐    │
     ├──│ Product  │────│  Variant   │    │
     │  └────┬─────┘    └─────┬──────┘    │
     │       │                │           │
     │       │          ┌─────┴──────┐    │
     │       │          │   Image    │    │
     │       │          └────────────┘    │
     │       │                            │
     │  ┌────┴─────┐                      │
     │  │ Pricing  │                      │
     │  │ Size     │                      │
     │  │ Service  │                      │
     │  │ FAQ      │                      │
     │  │ Detail   │                      │
     │  └──────────┘                      │
     │                                    │
     │  ┌──────────┐    ┌──────────────┐  │
     ├──│ Booking  │────│ BookingItem  │──┘
     │  └────┬─────┘    └──────────────┘
     │       │
     │  ┌────┴─────┐
     │  │ Payment  │
     │  └──────────┘
     │
     │  ┌──────────────┐
     ├──│ Notification │
     │  └──────────────┘
     │
     │  ┌──────────────┐
     └──│  AuditLog    │
        └──────────────┘

Global (no tenant_id):
  ┌──────────┐  ┌──────────────┐  ┌──────────┐
  │  Color   │  │ Subscription │  │ SaasAdmin│
  └──────────┘  └──────────────┘  └──────────┘
```

---

## Table Index

| # | Table | File | Tenant-Scoped |
|---|---|---|---|
| 1 | `tenants` | [tenant.md](./tenant.md) | No (global) |
| 2 | `users` | [user.md](./user.md) | No (global) |
| 3 | `products` | [product.md](./product.md) | Yes |
| 4 | `product_variants` | [product-variant.md](./product-variant.md) | Yes |
| 5 | `product_images` | [product-image.md](./product-image.md) | Yes |
| 6 | `categories` | [category.md](./category.md) | Yes |
| 7 | `subcategories` | [category.md](./category.md) | Yes |
| 8 | `events` | [event.md](./event.md) | Yes |
| 9 | `product_events` | [event.md](./event.md) | Yes (junction) |
| 10 | `colors` | [color.md](./color.md) | No (global) |
| 11 | `variant_colors` | [color.md](./color.md) | Yes (junction) |
| 12 | `product_sizes` | [size.md](./size.md) | Yes |
| 13 | `size_measurements` | [size.md](./size.md) | Yes |
| 14 | `size_parts` | [size.md](./size.md) | Yes |
| 15 | `product_pricing` | [pricing.md](./pricing.md) | Yes |
| 16 | `product_services` | [service-options.md](./service-options.md) | Yes |
| 17 | `bookings` | [booking.md](./booking.md) | Yes |
| 18 | `booking_items` | [booking-item.md](./booking-item.md) | Yes |
| 19 | `date_blocks` | [booking.md](./booking.md) | Yes |
| 20 | `payments` | [payment.md](./payment.md) | Yes |
| 21 | `customers` | [customer.md](./customer.md) | Yes |
| 22 | `customer_tags` | [customer.md](./customer.md) | Yes |
| 23 | `reviews` | [review.md](./review.md) | Yes |
| 24 | `product_faqs` | [faq.md](./faq.md) | Yes |
| 25 | `product_detail_headers` | [product-detail.md](./product-detail.md) | Yes |
| 26 | `product_detail_entries` | [product-detail.md](./product-detail.md) | Yes |
| 27 | `notifications` | [notification.md](./notification.md) | Yes |
| 28 | `audit_logs` | [audit-log.md](./audit-log.md) | Yes |
| 29 | `subscriptions` | [subscription.md](./subscription.md) | No (global) |
| 30 | `subscription_plans` | [subscription.md](./subscription.md) | No (global) |
| 31 | `store_settings` | [tenant.md](./tenant.md) | Yes |
| 32 | `damage_reports` | [booking-item.md](./booking-item.md) | Yes |

---

## Prisma Schema Organization

The Prisma schema will be in a single `schema.prisma` file (Prisma doesn't support multi-file schemas natively in v5). However, models are organized logically with comments:

```prisma
// ======================
// GLOBAL ENTITIES
// ======================
model Tenant { ... }
model User { ... }
model Color { ... }
model SubscriptionPlan { ... }

// ======================
// PRODUCT ENTITIES
// ======================
model Product { ... }
model ProductVariant { ... }
model ProductImage { ... }
// ... etc
```
