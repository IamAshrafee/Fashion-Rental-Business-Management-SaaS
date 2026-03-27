# Architecture Decision Record (ADR)

All key decisions made during the brainstorming phase, compiled as a reference for implementation.

---

## ADR-01: UI Framework Strategy

**Decision**: Tailwind CSS everywhere. ShadCN/ui for owner portal and SaaS admin portal. Custom Tailwind components for guest storefront.

**Rationale**: ShadCN gives production-quality UI components for internal tools. Guest storefront needs unique, brandable designs that don't look like a generic admin panel.

---

## ADR-02: Booking = Order (Unified Entity)

**Decision**: One `bookings` table. No separate `orders` table. A booking IS the order — status progression tracks the full lifecycle.

**Status flow**: `pending → confirmed → shipped → delivered → returned → inspected → completed` (with `cancelled` and `overdue` as side states).

**Rationale**: Two tables would add unnecessary joins and confusion. The rental business lifecycle is a single entity progressing through states.

---

## ADR-03: Cart is Client-Side Only

**Decision**: Cart lives entirely in `localStorage`. No `carts` database table. No cart API endpoints. Server validates at checkout.

**Rationale**: Zero-friction guest checkout (no login needed). A server-side cart requires auth and adds complexity with no benefit for the guest flow.

**Impact**: Delete `docs/database/cart.md` and `docs/api/cart.md`.

---

## ADR-04: Currency Handling

**Decision**: All prices stored as **integers** (no decimals). Rounding direction: **always round up**.

```
৳7,500 stored as → 7500
7500 × 3.5% = 262.5 → rounds to 263
```

**Rationale**: Bangladesh doesn't use paisa. Integer math avoids floating-point errors. Rounding up is business-friendly (never undercharge).

---

## ADR-05: Timezone Strategy

**Decision**: Global SaaS — server is UTC, each tenant configures their timezone.

| Data Type | Storage | Display |
|---|---|---|
| Timestamps (`created_at`, etc.) | UTC | Converted to tenant/user timezone |
| Booking dates (rental period) | Plain `DATE` (no timezone) | Calendar dates, timezone-irrelevant |
| CRON jobs | Run in UTC | Calculate per-tenant local time for scheduling |

**Rationale**: VPS is in USA, tenants can be from any country. UTC storage is the industry standard for global SaaS. Booking dates are calendar dates ("April 15th"), not moments in time.

---

## ADR-06: Monorepo Structure

**Decision**: Single repository with `/frontend`, `/backend`, `/packages` directories.

```
closetrent/
├── frontend/          # Next.js
├── backend/           # NestJS
├── packages/
│   └── types/         # Shared TypeScript types
├── docker-compose.yml
└── package.json       # Workspace root
```

**Rationale**: Solo developer, shared types, single CI/CD pipeline. Simplest possible setup.

---

## ADR-07: Shared TypeScript Types

**Decision**: `packages/types/` in monorepo. Both frontend and backend import from the same source.

```typescript
// packages/types/src/booking.ts
export interface Booking {
  id: string;
  tenantId: string;
  status: BookingStatus;
  // ...
}

// frontend imports
import { Booking } from '@closetrent/types';

// backend imports
import { Booking } from '@closetrent/types';
```

**Rationale**: Single source of truth prevents type drift between frontend and backend.

---

## ADR-08: Concurrent Booking Prevention

**Decision**: Database-level constraint. No application-level locking.

```sql
UNIQUE(product_variant_id, blocked_date) ON date_blocks
```

When two bookings race for the same dates, the first `INSERT` succeeds and the second violates the constraint → returns conflict error to the user.

**Rationale**: Simplest, most reliable. No Redis locks, no timeout management. Database is the source of truth.

---

## ADR-09: Buffer Days Between Bookings

**Decision**: Global setting per tenant + optional per-product override.

```
tenant.settings.defaultBufferDays = 1  (global default)
product.bufferDays = 2                 (overrides global for this product)
```

Buffer days are blocked after the return date. A 1-day buffer means if returned April 12th, next rental can start April 14th (April 13th is buffer).

---

## ADR-10: Booking Cancellation

**Decision**: Configurable per tenant. Each business sets their own policy in store settings.

Default policy: Free cancellation before "Shipped" status. No automated cancellation fees in v1.

---

## ADR-11: Multi-Item Cart Conflict

**Decision**: Block entire checkout if any item is unavailable. Show clear error identifying which item(s) have conflicts.

---

## ADR-12: Deletion Strategy

**Decision**: Soft delete with trash + active booking protection. See `docs/deletion-strategy.md` for full details.

---

## ADR-13: Subscription Plans

**Decision**: Highly configurable by SaaS admin. Plan limits stored in database, not hardcoded. Admin can create/modify plans with feature gates and limits.

---

## ADR-14: Localization — Everything Tenant-Configurable

| Setting | Scope | Details |
|---|---|---|
| Currency | Per-tenant | Currency code + symbol (BDT, USD, THB, etc.) |
| Phone validation | Per-tenant country | Based on tenant's country setting |
| Address format | Per-tenant | Configurable fields (tenant defines which fields to show) |
| Language | System-wide | English only for v1. Multi-language ready architecture. |
| Date format | Per-tenant | DD/MM/YYYY or MM/DD/YYYY |
| Number format | Per-tenant | South Asian (lakhs) or standard (millions) |
| Timezone | Per-tenant | IANA timezone (e.g., `Asia/Dhaka`, `Asia/Bangkok`) |

---

## ADR-15: Frontend State Management

| State Type | Solution |
|---|---|
| Global (tenant, auth) | React Context |
| Server data (products, bookings) | TanStack Query |
| Forms (multi-step wizard, settings) | React Hook Form |
| URL state (filters, sort, pagination) | `searchParams` |
| Cart | localStorage + custom hook |

---

## ADR-16: Search

**Decision**: PostgreSQL trigram search (`pg_trgm`) for v1. Upgrade to Meilisearch if needed.

---

## ADR-17: Background Jobs

**Decision**: BullMQ with Redis. Job queue with retry, delay, priority, and Bull Board monitoring.

---

## ADR-18: Real-Time Updates

**Decision**: No real-time for v1. Refetch on page load + double-check at checkout. Add SSE later if needed.

---

## ADR-19: Image CDN

**Decision**: MinIO behind Cloudflare proxy. Free global CDN caching for all product images.

---

## ADR-20: Admin Portal

**Decision**: Same Next.js app, `/admin` routes accessible only via `admin.closetrent.com` subdomain.

---

## ADR-21: Tenant Subscription Expiry

**Decision**: 7-day grace period → read-only mode → 30 days → store fully offline. Data retained indefinitely.

---

## ADR-22: SaaS Billing

**Decision**: Not in v1. Launch as free/invite-only. Add automated billing in Phase 10.

---

## ADR-23: Tenant Seed Data

**Decision**: SaaS admin manages starter templates. Configurable default categories, events, and settings per country/industry.

---

## ADR-24: Product Slug Scope

**Decision**: `UNIQUE(tenant_id, slug)`. Different tenants can have the same slug.

---

## ADR-25: Image Orphan Cleanup

**Decision**: Daily CRON job. Find images not linked to any product, delete if older than 24 hours.

---

## ADR-26: Audit Log Scope

**Decision**: All status changes + security events. Not every DB write.

Logged: login, booking status changes, payment recordings, deposit actions, settings changes, role changes, product publish/unpublish.

---

## ADR-27: Event System

**Decision**: NestJS EventEmitter2. Event-driven side effects from day 1.

When booking status changes → emit event → separate listeners handle SMS, notifications, audit log, date blocks, etc.

---

## ADR-28: SEO

**Decision**: Full SEO — OpenGraph, Schema.org, sitemap per tenant, canonical URLs. Critical for tenant success (WhatsApp/Facebook sharing).
