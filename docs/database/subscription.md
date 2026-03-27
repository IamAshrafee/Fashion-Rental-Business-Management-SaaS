# Database Schema: `subscription_plans` + `subscriptions`

## Table: `subscription_plans`

Global — defines available SaaS plans.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `name` | VARCHAR(50) | No | — | Plan name (Free, Basic, Pro) |
| `slug` | VARCHAR(50) | No | — | URL-safe identifier |
| `price_monthly` | DECIMAL(10,2) | No | — | Monthly price |
| `price_annual` | DECIMAL(10,2) | Yes | `NULL` | Annual price (if offered) |
| `max_products` | INT | Yes | `NULL` | Max products (NULL = unlimited) |
| `max_staff` | INT | No | `0` | Max staff members |
| `custom_domain` | BOOLEAN | No | `false` | Custom domain allowed |
| `sms_enabled` | BOOLEAN | No | `false` | SMS notifications included |
| `analytics_full` | BOOLEAN | No | `false` | Full analytics access |
| `remove_branding` | BOOLEAN | No | `false` | Remove "Powered by" |
| `is_active` | BOOLEAN | No | `true` | Plan available for purchase |
| `display_order` | INT | No | `0` | Display ordering |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `subscription_plans_slug_key` | `slug` | UNIQUE |

---

## Table: `subscriptions`

Tracks each tenant's active subscription.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `plan_id` | UUID | No | — | FK → `subscription_plans.id` |
| `status` | ENUM | No | `'active'` | active, past_due, cancelled, trial |
| `billing_cycle` | ENUM | No | `'monthly'` | monthly, annual |
| `current_period_start` | TIMESTAMP | No | — | Period start |
| `current_period_end` | TIMESTAMP | No | — | Period end |
| `trial_ends_at` | TIMESTAMP | Yes | `NULL` | Trial expiry |
| `cancelled_at` | TIMESTAMP | Yes | `NULL` | When cancelled |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Enums

```prisma
enum SubscriptionStatus {
  active
  past_due
  cancelled
  trial
}

enum BillingCycle {
  monthly
  annual
}
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `subscriptions_tenant_id_key` | `tenant_id` | UNIQUE |
| `subscriptions_plan_id_idx` | `plan_id` | INDEX |
| `subscriptions_status_idx` | `status` | INDEX |

---

## Prisma Models

```prisma
model SubscriptionPlan {
  id              String         @id @default(uuid())
  name            String
  slug            String         @unique
  priceMonthly    Decimal        @map("price_monthly") @db.Decimal(10, 2)
  priceAnnual     Decimal?       @map("price_annual") @db.Decimal(10, 2)
  maxProducts     Int?           @map("max_products")
  maxStaff        Int            @default(0) @map("max_staff")
  customDomain    Boolean        @default(false) @map("custom_domain")
  smsEnabled      Boolean        @default(false) @map("sms_enabled")
  analyticsFull   Boolean        @default(false) @map("analytics_full")
  removeBranding  Boolean        @default(false) @map("remove_branding")
  isActive        Boolean        @default(true) @map("is_active")
  displayOrder    Int            @default(0) @map("display_order")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  tenants         Tenant[]
  subscriptions   Subscription[]

  @@map("subscription_plans")
}

model Subscription {
  id                  String             @id @default(uuid())
  tenantId            String             @unique @map("tenant_id")
  planId              String             @map("plan_id")
  status              SubscriptionStatus @default(active)
  billingCycle        BillingCycle       @default(monthly) @map("billing_cycle")
  currentPeriodStart  DateTime           @map("current_period_start")
  currentPeriodEnd    DateTime           @map("current_period_end")
  trialEndsAt         DateTime?          @map("trial_ends_at")
  cancelledAt         DateTime?          @map("cancelled_at")
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  tenant              Tenant             @relation(fields: [tenantId], references: [id])
  plan                SubscriptionPlan   @relation(fields: [planId], references: [id])

  @@index([planId])
  @@index([status])
  @@map("subscriptions")
}
```
