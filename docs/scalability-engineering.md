# Scalability Engineering — ClosetRent SaaS

How the system scales from 1 tenant on a single VPS to 1,000+ tenants across distributed infrastructure — with **zero code rewrites** at each transition.

---

## 1. Current Baseline Capacity

| Metric | Single VPS (4 CPU, 8 GB RAM) |
|---|---|
| Concurrent users | 100–200 |
| Bookings/day | 500–1,000 |
| Active tenants | 50–100 |
| Products (total) | 50,000 |
| Images stored | ~50 GB (10,000 products × 5 MB avg) |
| API requests/sec | 150–300 |
| Database size | 2–10 GB |

> This handles the first 12–18 months of growth comfortably.

---

## 2. Database Scalability

### 2.1 — Connection Pooling (Day 1)

```
App (NestJS) → Prisma Pool (20 connections) → PostgreSQL
```

**Config**: `DATABASE_URL=...?connection_limit=20&pool_timeout=10`

### 2.2 — Query Complexity Control (Day 1)

| Pattern | Rule |
|---|---|
| Max JOINs per query | 3 (enforce in code review) |
| Max `include` depth | 2 levels |
| List endpoints | Must use pagination (default 20, max 100) |
| Dashboard stats | Denormalized counters (not live COUNT queries) |
| Search | `tsvector` + `pg_trgm` — no LIKE '%query%' |

### 2.3 — Table Partitioning (50+ Tenants)

Partition high-volume tables by `tenant_id` using PostgreSQL declarative partitioning:

```sql
-- Convert bookings to partitioned table
CREATE TABLE bookings (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  ...
) PARTITION BY HASH (tenant_id);

-- Auto-create partitions (e.g., 16 partitions)
CREATE TABLE bookings_p0 PARTITION OF bookings FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE bookings_p1 PARTITION OF bookings FOR VALUES WITH (MODULUS 16, REMAINDER 1);
-- ... etc
```

**Candidates for partitioning** (by access volume):
1. `bookings` — highest write volume
2. `date_blocks` — checked on every availability query
3. `booking_items` — grows proportionally with bookings
4. `audit_logs` — append-only, grows fastest
5. `notifications` — high volume per tenant

**Not partitioned** (small tables, mostly read):
- `tenants`, `users`, `products`, `categories`, `store_settings`

### 2.4 — Read Replicas (100+ Tenants)

```
                   ┌─ Read Replica 1 (Analytics, Exports)
Primary DB ────────┤
(Writes + Reads)   └─ Read Replica 2 (Storefront Reads)
```

**Implementation**: Use Prisma's multi-datasource capability:

```typescript
// Read-heavy queries route to replica
const products = await prisma.$replica.product.findMany({ ... });

// Writes always go to primary
await prisma.booking.create({ ... });
```

**Routing strategy**:

| Query Type | Target |
|---|---|
| Storefront product listings | Replica |
| Availability check | Primary (must be accurate) |
| Search | Replica |
| Booking creation | Primary |
| Dashboard analytics | Replica |
| Customer list | Replica |
| Report exports | Replica |

### 2.5 — PgBouncer (Multiple Backend Instances)

When running 2+ NestJS instances, connection pool multiplexing becomes critical:

```
NestJS-1 (20 conn) ──┐
                      ├── PgBouncer (pool 50) ──→ PostgreSQL
NestJS-2 (20 conn) ──┘
```

Without PgBouncer: 40 persistent connections. With: shared pool of 50, dynamically allocated.

---

## 3. Application Scalability

### 3.1 — Stateless Backend (Day 1 Design)

The NestJS backend is **fully stateless**:
- No in-memory sessions (JWT-based auth)
- No local file storage (MinIO/S3)
- No in-memory cache (Redis)
- No sticky sessions required

This means: **spin up N instances, put a load balancer in front, done.**

### 3.2 — Horizontal Scaling

```
                    ┌── NestJS Instance 1
Nginx (LB) ────────┤── NestJS Instance 2
                    └── NestJS Instance 3
```

**Load balancing strategy**: Round-robin (stateless, any instance can handle any request).

**Scaling triggers**:

| Metric | Threshold | Action |
|---|---|---|
| CPU per instance | > 70% sustained | Add instance |
| Response time p95 | > 500ms | Add instance |
| Queue depth | > 50 pending jobs | Add worker instance |
| Memory per instance | > 80% | Add instance or increase RAM |

### 3.3 — Background Job Workers (Separate Scale)

BullMQ workers can run as separate processes from the API:

```
API Server (NestJS) ──→ Redis ←── Worker 1 (notifications)
                              ←── Worker 2 (scheduler)
                              ←── Worker 3 (cleanup)
```

**Scale independently**: Heavy SMS periods? Add notification workers. API overloaded? Workers don't compete for the same resources.

### 3.4 — Event-Driven Decoupling

The `EventEmitter2` pattern means:
- Booking creation doesn't wait for SMS to send
- Image upload doesn't wait for thumbnail generation
- Audit logging doesn't block API responses

**Future upgrade path**: Replace `EventEmitter2` with **Redis Pub/Sub** or **NATS** for cross-instance events with zero code refactoring (same event interface, different transport).

---

## 4. Storage Scalability

### 4.1 — Image Pipeline Growth

| Tenants | Products (est.) | Images (est.) | Storage |
|---|---|---|---|
| 10 | 1,000 | 6,000 | ~5 GB |
| 50 | 5,000 | 30,000 | ~25 GB |
| 100 | 10,000 | 60,000 | ~50 GB |
| 500 | 50,000 | 300,000 | ~250 GB |
| 1,000 | 100,000 | 600,000 | ~500 GB |

### 4.2 — Migration Path

```
Stage 1: MinIO on VPS (0–50 GB)
  ↓ Change env var only
Stage 2: MinIO on dedicated VPS (50–250 GB)
  ↓ Change env var only (S3-compatible API)
Stage 3: Cloudflare R2 / AWS S3 (250+ GB)
```

**Why R2/S3?**
- No egress fees (R2) or cost-effective egress (S3)
- Infinite storage
- Built-in CDN integration
- 99.99% durability

**Migration**: Zero code changes — MinIO uses S3-compatible API.

### 4.3 — CDN Strategy (Day 1)

```
User → Cloudflare CDN → Nginx → MinIO/S3
                ↑
         Cached at edge
```

**Cache rules**:

| Pattern | Cache TTL | Notes |
|---|---|---|
| Product images (hashed URL) | 1 year | Immutable — URL changes on re-upload |
| Tenant logo/favicon | 1 hour | May change during branding setup |
| PDF exports | No cache | Dynamic content |

---

## 5. Multi-Tenant Scalability

### 5.1 — Noisy Neighbor Prevention

One tenant with 50,000 products should not slow down other tenants.

| Protection | Implementation |
|---|---|
| **Rate limiting per tenant** | Nginx `$http_host` rate zone — max 120 req/min per subdomain |
| **Query timeout** | PostgreSQL `statement_timeout = 5s` for storefront queries |
| **Resource limits** | Subscription plan-based limits (max products, max images, max staff) |
| **Background job priority** | Lower priority for free-tier tenants |

### 5.2 — Tenant Resource Limits (Plan-Based)

| Resource | Free Plan | Pro Plan | Enterprise |
|---|---|---|---|
| Products | 50 | 500 | Unlimited |
| Images per product | 3 | 10 | 20 |
| Staff accounts | 1 | 5 | Unlimited |
| Storage (images) | 500 MB | 5 GB | 50 GB |
| API calls/day | 5,000 | 50,000 | Unlimited |
| SMS/month | 100 | 1,000 | 10,000 |
| Custom domain | ✗ | ✓ | ✓ |
| Report exports | ✗ | ✓ | ✓ |

**Enforcement**: Middleware checks tenant's plan limits before write operations.

### 5.3 — Tenant Data Isolation Audit

Every query path MUST include `tenant_id`. Enforcement:

```typescript
// Prisma middleware — reject any query without tenant_id filter
prisma.$use(async (params, next) => {
  const tenantScopedModels = ['Product', 'Booking', 'Customer', ...];
  if (tenantScopedModels.includes(params.model)) {
    const hasTenantFilter = params.args?.where?.tenantId;
    if (!hasTenantFilter && params.action !== 'create') {
      throw new Error(`Query on ${params.model} missing tenant_id filter`);
    }
  }
  return next(params);
});
```

---

## 6. Frontend Scalability

### 6.1 — SSR/SSG Strategy per Page

| Page | Rendering | Cache |
|---|---|---|
| Product listing | SSR | CDN 5 min |
| Product detail | SSR | CDN 1 min |
| Category pages | SSR | CDN 10 min |
| Checkout | CSR | No cache |
| Owner dashboard | CSR | No cache |
| Admin panel | CSR | No cache |
| FAQ pages | SSG (ISR) | CDN 1 hour |
| Static pages (about, contact) | SSG (ISR) | CDN 1 hour |

### 6.2 — Edge Deployment (Stage 4)

Move Next.js to **Vercel** or **Cloudflare Pages**:
- Automatic global edge distribution
- Backend API stays on VPS
- CORS configured for `*.closetrent.com`
- Image optimization via Vercel/Cloudflare

**Zero backend changes needed** — frontend already communicates via `NEXT_PUBLIC_API_URL`.

---

## 7. Redis Scalability

### 7.1 — Current: Single Redis Instance

Handles cache + sessions + BullMQ + pub/sub for up to ~500 concurrents.

### 7.2 — Scaling Triggers

| Metric | Threshold | Action |
|---|---|---|
| Memory usage | > 180 MB (of 200 MB limit) | Increase `maxmemory` or scale up |
| Ops/sec | > 10,000 | Consider Redis Cluster |
| Key count | > 500,000 | Review TTL strategy |

### 7.3 — Redis Sentinel / Cluster (500+ Tenants)

```
Redis Sentinel (HA)       OR       Redis Cluster (Sharding)
┌─ Primary                         ┌─ Shard 1 (keys a-m)
├─ Replica 1                       ├─ Shard 2 (keys n-z)
└─ Replica 2                       └─ Shard 3 (overflow)
```

**Recommendation**: Start with Sentinel for HA (automatic failover). Cluster only if single-instance memory limit is reached.

---

## 8. Scaling Timeline & Cost Projection

### Growth Stages

```
Stage 1: Solo VPS ($8/mo)
├── 0–50 tenants, 0–500 bookings/day
├── All services on 1 VPS
└── Trigger: CPU > 70% or RAM > 80%

Stage 2: Database Separation ($8 + $15 = $23/mo)
├── 50–200 tenants
├── PostgreSQL → dedicated VPS or managed DB
└── Trigger: DB queries > 500ms p95

Stage 3: Storage Separation ($23 + $5 = $28/mo)
├── 200–500 tenants
├── MinIO → Cloudflare R2 ($0.015/GB/mo)
└── Trigger: Storage > 50 GB

Stage 4: Edge Frontend ($28 + $20 = $48/mo)
├── 500+ tenants, international traffic
├── Next.js → Vercel Pro
└── Trigger: TTFB > 1s for distant users

Stage 5: Multi-Instance Backend ($48 + $15 = $63/mo)
├── 500–1,000 tenants
├── 2× NestJS behind Nginx LB + PgBouncer
└── Trigger: API p95 > 500ms

Stage 6: Full Distribution ($100–200/mo)
├── 1,000+ tenants
├── Managed DB, Redis Sentinel, 3× API, R2, Vercel
└── Trigger: Revenue justifies infrastructure investment
```

### Cost vs Revenue Analysis

| Tenants | Infra Cost/mo | Revenue (at $10/tenant/mo) | Margin |
|---|---|---|---|
| 10 | $8 | $100 | 92% |
| 50 | $8 | $500 | 98% |
| 100 | $23 | $1,000 | 98% |
| 500 | $48 | $5,000 | 99% |
| 1,000 | $200 | $10,000 | 98% |

---

## 9. Code-Level Scalability Patterns

### 9.1 — Abstract All External Services

Every external service must be behind an interface:

```typescript
// ✅ Good — swappable
interface StorageProvider {
  upload(file: Buffer, key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

class MinioStorage implements StorageProvider { ... }
class S3Storage implements StorageProvider { ... }
class R2Storage implements StorageProvider { ... }
```

**Already abstracted** (per architecture docs):
- ✅ Storage (MinIO → S3/R2)
- ✅ Payment (SSLCommerz — adapter pattern)
- ✅ Courier (Pathao/Steadfast — adapter pattern)
- ✅ SMS (provider adapter)

### 9.2 — Configuration via Environment Variables

All service endpoints configurable via env vars (already in infrastructure.md):
- `DATABASE_URL` — switch DB instance
- `REDIS_URL` — switch Redis instance
- `STORAGE_ENDPOINT` — switch storage
- `NEXT_PUBLIC_API_URL` — switch API

### 9.3 — Idempotent Operations

All booking/payment operations must be idempotent:

```typescript
// Booking creation — idempotent via unique booking_number
async createBooking(data: CreateBookingDto): Promise<Booking> {
  const bookingNumber = generateBookingNumber(data.tenantId);
  return this.prisma.booking.upsert({
    where: { tenantId_bookingNumber: { tenantId: data.tenantId, bookingNumber } },
    create: { ...data, bookingNumber },
    update: {},  // No update if already exists
  });
}
```

### 9.4 — Graceful Degradation

| Service Down | Fallback |
|---|---|
| Redis down | Direct DB queries (slower but functional) |
| SMS provider down | Queue retries, fallback to second provider |
| MinIO down | Serve cached images from CDN, queue uploads |
| Payment gateway down | Show "Try again later", hold pending status |

---

## 10. What NOT To Scale Prematurely

| Temptation | Why Not Yet |
|---|---|
| Kubernetes | Overkill for < 500 tenants. Docker Compose is sufficient. |
| Microservices | Monorepo with module boundaries. Split only when a module needs independent scaling. |
| GraphQL | REST is simpler and sufficient for this data model. |
| Multi-region DB | Single-region with CDN handles global reads. Only for compliance. |
| Redis Cluster | Single instance handles 10K+ ops/sec. Cluster adds complexity. |
| Event streaming (Kafka) | EventEmitter2 → Redis Pub/Sub is sufficient for years. |

---

## 11. Monitoring for Scale Triggers

| What to Monitor | Tool | Alert Threshold |
|---|---|---|
| CPU usage | Docker stats / Prometheus | > 70% sustained 10 min |
| Memory usage | Docker stats / Prometheus | > 80% |
| DB query time p95 | PostgreSQL `pg_stat_statements` | > 200ms |
| API response time p95 | Nginx access logs | > 500ms |
| Redis memory | Redis INFO | > 80% of maxmemory |
| Disk usage | df / Prometheus | > 80% |
| Queue depth | Bull Board | > 50 pending jobs |
| Error rate | Application logs | > 1% of requests |
