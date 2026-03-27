# System Architecture — ClosetRent SaaS

## Architecture Overview

ClosetRent is a **multi-tenant SaaS platform** deployed as a **monorepo** with a clear separation between three portals, a shared API backend, and isolated data per tenant. The platform is **globally deployable** — each tenant configures their own timezone, currency, and locale.

```
┌──────────────────────────────────────────────────────────┐
│                      CLIENTS                             │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Guest Portal │  │ Owner Portal │  │ Admin Portal │   │
│  │  (Next.js)   │  │  (Next.js)   │  │  (Next.js)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │            │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                   REVERSE PROXY (Nginx)                  │
│  - SSL termination (Let's Encrypt)                       │
│  - Subdomain / custom domain routing                     │
│  - Static asset caching                                  │
│  - Rate limiting                                         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   BACKEND API (NestJS)                   │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Auth Guard  │  │Tenant Guard │  │ Role Guard  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│  ┌──────▼──────────────────────────────────▼──────┐     │
│  │              Request Pipeline                   │     │
│  │  Middleware → Guards → Interceptors → Handlers  │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │              Service Layer                       │     │
│  │  ProductService │ BookingService │ OrderService   │     │
│  │  TenantService  │ PaymentService │ UploadService  │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │    MinIO      │
│  (Database)  │  │   (Cache)    │  │  (Storage)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Multi-Tenant Architecture

### Tenant Identification

Every incoming request is resolved to a specific tenant based on the **Host header** (domain or subdomain).

```
Request comes in
  → Read Host header
  → Look up domain/subdomain in tenants table
  → Attach tenant context to request
  → All subsequent DB queries scoped by tenant_id
```

**Resolution priority:**
1. Custom domain match (e.g., `rentbysara.com`)
2. Subdomain match (e.g., `hanasboutique.closetrent.com`)

If no tenant is found → return 404 "Store not found"

### Data Isolation Strategy

**Model: Shared database, shared tables, `tenant_id` column.**

Every table that contains tenant-specific data includes a `tenant_id` column. Every query must include `WHERE tenant_id = ?`.

**Why this model:**
- Simple to manage
- Low infrastructure overhead (single database)
- Easy backup and restore
- Scales well to hundreds of tenants
- Can migrate large tenants to separate DB later if needed

**Critical rules:**
- No query may omit `tenant_id` filtering (except SaaS admin queries)
- Backend must use a middleware/guard that injects `tenant_id` into every query context
- Prisma client should be extended to auto-scope queries by tenant
- Redis cache keys must be prefixed with `tenant_id`
- MinIO storage paths must be prefixed with `tenant_id`

### Storage Isolation (MinIO)

```
minio-data/
├── tenant-101/
│   ├── products/
│   │   ├── product-uuid/
│   │   │   ├── variant-1-featured.webp
│   │   │   ├── variant-1-gallery-1.webp
│   │   │   ├── variant-2-featured.webp
│   │   │   └── ...
│   │   └── ...
│   └── branding/
│       ├── logo.webp
│       └── banner-1.webp
├── tenant-205/
│   └── ...
```

File URLs always include tenant context. No cross-tenant file access.

---

## Domain & Routing Strategy

### Subdomain Routing

Each tenant automatically gets a subdomain:

```
<slug>.closetrent.com.bd
```

Configuration:
- Wildcard DNS: `*.closetrent.com.bd → VPS IP`
- Wildcard SSL: via Cloudflare or Let's Encrypt
- Nginx: catch-all server block forwards to Next.js

### Custom Domain (Future)

Business owners can connect their own domain:

1. Owner adds domain in settings
2. System generates instructions:
   - Point A record to our IP, OR
   - Point CNAME to `closetrent.com.bd`
3. Backend verifies DNS resolution
4. Nginx generates server block for the domain
5. SSL auto-provisioned via Let's Encrypt

### Routing Table

| URL Pattern | Resolves To |
|---|---|
| `<slug>.closetrent.com` | Guest Portal for tenant |
| `<slug>.closetrent.com.bd/owner` | Owner Portal for tenant |
| `admin.closetrent.com` | SaaS Admin Portal |
| `<custom-domain>` | Guest Portal for tenant |

---

## Backend Architecture (NestJS)

### Module Structure

```
src/
├── common/
│   ├── guards/           # Auth, Tenant, Role guards
│   ├── interceptors/     # Response transform, logging
│   ├── decorators/       # Custom decorators (@TenantId, @CurrentUser)
│   ├── filters/          # Exception filters
│   ├── pipes/            # Validation pipes
│   └── utils/            # Shared utilities
│
├── modules/
│   ├── auth/             # Authentication & authorization
│   ├── tenant/           # Tenant management
│   ├── product/          # Product CRUD, variants, images
│   ├── category/         # Categories, subcategories, events
│   ├── inventory/        # Availability checking, stock status
│   ├── booking/          # Booking creation, lifecycle
│   ├── order/            # Order management, fulfillment
│   ├── cart/             # Cart operations
│   ├── customer/         # Customer profiles
│   ├── payment/          # Payment processing
│   ├── upload/           # File upload to MinIO
│   ├── search/           # Search & filter
│   ├── notification/     # SMS, email, in-app
│   ├── analytics/        # Reporting & dashboard data
│   └── admin/            # SaaS admin operations
│
├── config/               # Environment config, validation
├── prisma/               # Prisma schema, migrations, seed
└── main.ts               # App bootstrap
```

**Monorepo structure:**
```
closetrent/
├── frontend/          # Next.js app
├── backend/           # NestJS app
├── packages/
│   └── types/         # Shared TypeScript types (@closetrent/types)
├── docker-compose.yml
└── package.json       # npm workspaces root
```

### Request Lifecycle

```
Incoming Request
  → Nginx (SSL, routing)
  → NestJS Middleware (logging, CORS)
  → Tenant Guard (resolve tenant from host)
  → Auth Guard (verify JWT/session)
  → Role Guard (check permission level)
  → Validation Pipe (validate request body)
  → Controller (route to handler)
  → Service (business logic)
  → Prisma (database query, scoped by tenant_id)
  → Response Interceptor (format response)
  → Client
```

---

## Frontend Architecture (Next.js)

### Project Structure

The frontend is a single Next.js application that serves all three portals, differentiated by routing.

```
src/
├── app/
│   ├── (guest)/          # Guest portal routes (storefront)
│   │   ├── page.tsx      # Shopping page
│   │   ├── product/
│   │   ├── cart/
│   │   └── checkout/
│   ├── (owner)/          # Owner portal routes
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   └── settings/
│   └── (admin)/          # Admin portal routes
│       ├── tenants/
│       ├── billing/
│       └── support/
│
├── components/
│   ├── guest/            # Guest-specific components
│   ├── owner/            # Owner-specific components
│   ├── admin/            # Admin-specific components
│   └── shared/           # Shared components (buttons, modals, etc.)
│
├── lib/                  # API client, utilities, hooks
├── styles/               # Global styles, design tokens
└── types/                # TypeScript type definitions
```

### Rendering Strategy

| Page Type | Rendering | Reason |
|---|---|---|
| Product listing | SSR | SEO, social sharing, performance |
| Product details | SSR | SEO, social sharing (og:image) |
| Owner dashboard | CSR | No SEO needed, real-time data |
| Admin portal | CSR | Internal tool, no SEO |
| Cart / Checkout | CSR | User-specific, dynamic |

### Tenant Context Loading

On every page load:
1. Read hostname (client-side or server-side)
2. Call backend `/api/tenant/info` with hostname
3. Receive: logo, brand colors, business name, contact info, social links
4. Apply branding (colors, logo) and locale (timezone, currency, date format) to storefront
5. Cache tenant info in memory/local storage

---

## Data Flow Diagrams

### Guest Books a Product

```
Guest                   Frontend              Backend              Database
  │                        │                     │                    │
  │  Browse products       │                     │                    │
  │───────────────────────>│  GET /products       │                    │
  │                        │────────────────────>│  SELECT * FROM      │
  │                        │                     │  products WHERE     │
  │                        │                     │  tenant_id = X      │
  │                        │<────────────────────│<───────────────────│
  │  Product list          │                     │                    │
  │<───────────────────────│                     │                    │
  │                        │                     │                    │
  │  Select dates          │                     │                    │
  │───────────────────────>│  GET /availability   │                    │
  │                        │────────────────────>│  Check bookings     │
  │  Available/Unavailable │                     │  for date range     │
  │<───────────────────────│<────────────────────│<───────────────────│
  │                        │                     │                    │
  │  Book Now              │                     │                    │
  │───────────────────────>│  POST /bookings      │                    │
  │                        │────────────────────>│  INSERT booking     │
  │                        │                     │  + block dates      │
  │  Booking confirmed     │                     │  + notify owner     │
  │<───────────────────────│<────────────────────│<───────────────────│
```

### Owner Adds a Product

```
Owner                   Frontend              Backend              MinIO      Database
  │                        │                     │                   │            │
  │  Fill product form     │                     │                   │            │
  │───────────────────────>│                     │                   │            │
  │  Upload images         │                     │                   │            │
  │───────────────────────>│  POST /upload        │                   │            │
  │                        │────────────────────>│  PUT to MinIO     │            │
  │                        │                     │──────────────────>│            │
  │                        │                     │  Return file URLs  │            │
  │  Images uploaded       │<────────────────────│<──────────────────│            │
  │<───────────────────────│                     │                   │            │
  │  Submit product        │                     │                   │            │
  │───────────────────────>│  POST /products      │                   │            │
  │                        │────────────────────>│  INSERT product    │            │
  │                        │                     │  + variants        │            │
  │                        │                     │  + pricing         │            │
  │  Product created       │                     │  + images          │            │
  │<───────────────────────│<────────────────────│──────────────────────────────>│
```

---

## Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|---|---|---|---|
| Tenant info (branding, config) | Redis | 1 hour | On settings update |
| Product list (per tenant) | Redis | 5 minutes | On product add/edit/delete |
| Product details | Redis | 10 minutes | On product edit |
| Availability for product | Redis | 1 minute | On booking creation/cancellation |
| Category/event lists | Redis | 24 hours | On category/event change |
| Search results | Not cached | — | — |

---

## Error Handling Strategy

### Backend Error Response Format

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "rentalDays",
      "message": "Must be at least 1 day"
    }
  ],
  "timestamp": "2026-03-27T05:00:00.000Z",
  "path": "/api/products"
}
```

### Error Categories

| Status Code | When |
|---|---|
| 400 | Validation errors, bad input |
| 401 | Not authenticated |
| 403 | Not authorized (wrong role or wrong tenant) |
| 404 | Resource not found (or tenant not found) |
| 409 | Conflict (e.g., booking overlaps) |
| 429 | Rate limited |
| 500 | Unexpected server error |

---

## Security Architecture

See `docs/security/` for detailed specs. Key principles:

1. **Authentication**: JWT-based with refresh tokens (15 min access / 7 day refresh). Sessions DB-backed with device tracking.
2. **Tenant Isolation**: Every request passes through `TenantGuard`. No query executes without `tenant_id`.
3. **Role-Based Access**: Guest, Owner, Manager, Staff, Admin — each has defined permissions.
4. **Input Validation**: All inputs validated via class-validator DTOs in NestJS.
5. **File Upload Security**: Image type validation, size limits, magic byte verification.
6. **HTTPS Only**: All traffic encrypted. HTTP → HTTPS redirect via Nginx.
7. **Rate Limiting**: Per-IP and per-tenant rate limits to prevent abuse.
8. **Session Management**: Active session tracking, revocation, login history.
