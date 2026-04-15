# Multi-Tenant Resource Governance & Metering

This module provides enterprise-grade resource governance, API rate limiting, and analytics snapshotting designed for multi-tenant environments. 

By utilizing dynamic Redis pipelines and memory-buffered intercepts, the platform is shielded from the "noisy neighbor" problem while maintaining near-zero impact on the operational latencies of tenant requests.

## 🌟 Architecture Overview

The system operates across three core domains:

1. **High-Speed Traffic Cop (Rate Limiting)**
2. **Buffer-and-Flush Metering (Data Collection)**
3. **Background Aggregation (BullMQ Snapshots)**

---

### High-Speed Traffic Cop (`TenantRateLimitGuard`)
We have completely replaced the default global `ThrottlerModule` with a smarter, plan-aware algorithm specifically tailored for our SaaS model.

- **Plan-Driven Limits**: Every `Tenant` is tied to a `SubscriptionPlan`. This plan dictates the maximum bursts (`maxRpm`) and total daily request quotas (`maxApiCallsDaily`).
- **Redis Caching**: The guard fetches the plan from Redis, falling back to PostgreSQL if uncached, then saves it locally in Redis for 1 hour. This ensures authorization takes `< 1ms`.
- **Fail-Open Mechanics**: If Redis experiences downtime, the system deliberately "fails open." It allows requests to pass rather than blocking legitimate traffic.

### Buffer-and-Flush Metering (`MeteringInterceptor`)
Running thousands of small increments against Redis for every HTTP request would eventually overwhelm tracking infrastructure. Instead, we use an in-memory batching pattern:

- **Interceptor Buffer:** All tracking logic runs *asynchronously* via RxJS `tap` after the HTTP response has been sent to the client. This means the overhead added to the request is literally 0ms.
- **In-Memory Tracking:** HTTP metrics (Latency Map, Bytes sent, HTTP Error codes, Request counts) are stored in an efficient memory map object by `tenantId`.
- **5-Second Atomic Flushes:** A background interval systematically swaps the memory map pointer and pushes the batch downstream using an atomic `Redis.pipeline()`. 
- **Scale Guarantee:** Whether you get 10 requests or 10,000 requests in a 5-second interval, only **one single roundtrip to Redis** occurs globally!

### Background Aggregation (`JobsService` & BullMQ)
The live data stored dynamically via Redis is volatile. We need historical persistency for tenant billing cycles and admin trend monitoring.

- **Hourly Snapshot:** Every hour, `metering.snapshotDaily` scoops all live aggregated metrics out of Redis (Daily counts, bandwidth totals) and `upserts` it into the PostgreSQL time-series `TenantUsageSnapshot` model.
- **Nightly Row Counter:** Finding the actual storage limit is expensive. The background job `metering.computeResourceUsage` executes nightly at 2:00 AM, scanning cross-tenant row counts (Products, Customers) and aggregating physical file sizes to approximate Storage MB usage.
- **Self Cleaning:** Once an analytics snapshot reaches 90-days of age, it is garbage collected to prevent PostgreSQL table bloat.

---

## 🛠 Flow Diagrams

### Request Lifecycle
1. Request arrives at Server.
2. `TenantRateLimitGuard` intercepts.
3. Does Tenant exist in Cache? -> If No, Fetch from Postgres & Cache.
4. Check burst usage `GET meter:rpm:TENANT`. Is it above `maxRpm`? -> `429 Too Many Requests`
5. Proceed to Controller → Process business logic.
6. Send Response to Client.
7. `MeteringInterceptor` detects the exit in memory buffer `+1 request, +N bandwidth`.
8. Execution lifecycle ends.

### Background Cycle
Every 5,000ms -> Interceptor fires -> `Redis.pipeline().incrby(TENANT, buffer).exec()`

---

## 💻 Working with the APIs

The data structured here natively powers the **Admin Dashboard** (`/admin/resources`).

**Available Services for internal injection via `MeteringService`:**
- `flushToRedis()`: Internal batch pipeline executor.
- `getLiveMetrics(tenantId)`: Returns current realtime RPM, Latency, and Byte transfers for a tenant.
- `getAllTenantsLiveMetrics()`: Batch loads operations for drawing admin dashboards.

## 🗄 Prisma Data Models Introduced

```prisma
model SubscriptionPlan {
  // Plan caps
  maxApiCallsDaily  Int?     // API limit per day (e.g. 50000)
  maxStorageMb      Int?     // Storage limit in MB
  maxRpm            Int?     @default(120) // Burst limit
}

model TenantUsageSnapshot {
  id                String   @id @default(uuid())
  tenantId          String
  snapshotDate      DateTime @db.Date  // Time-series anchor
  
  // API Limits
  apiCallsTotal     Int      @default(0)
  peakRpm           Int      @default(0)
  totalBandwidthKb  Int      @default(0)
  avgLatencyMs      Int      @default(0)
  errorCount        Int      @default(0)

  // DB Limits
  storageUsedMb     Float    @default(0)
  productCount      Int      @default(0)
  bookingCount      Int      @default(0)
}
```
