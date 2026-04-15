-- ============================================================================
-- Migration: Add Tenant Resource Metering
-- Adds plan-level resource limit columns and the tenant_usage_snapshots table
-- for the per-tenant governance & observability system.
-- ============================================================================

-- 1. Add resource governance limit columns to subscription_plans
ALTER TABLE "subscription_plans"
  ADD COLUMN "max_api_calls_daily" INTEGER,
  ADD COLUMN "max_storage_mb" INTEGER,
  ADD COLUMN "max_rpm" INTEGER NOT NULL DEFAULT 120;

-- 2. Create tenant_usage_snapshots table (hourly Redis→PG aggregation)
CREATE TABLE "tenant_usage_snapshots" (
    "id"                   TEXT NOT NULL,
    "tenant_id"            TEXT NOT NULL,
    "snapshot_date"        DATE NOT NULL,

    -- API Metrics (from Redis counters)
    "api_request_count"    INTEGER NOT NULL DEFAULT 0,
    "avg_response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "p95_response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "error_count"          INTEGER NOT NULL DEFAULT 0,
    "total_bandwidth_kb"   INTEGER NOT NULL DEFAULT 0,
    "peak_rpm"             INTEGER NOT NULL DEFAULT 0,

    -- Resource Metrics (from daily scan job)
    "product_count"        INTEGER NOT NULL DEFAULT 0,
    "booking_count"        INTEGER NOT NULL DEFAULT 0,
    "customer_count"       INTEGER NOT NULL DEFAULT 0,
    "staff_count"          INTEGER NOT NULL DEFAULT 0,
    "storage_used_mb"      INTEGER NOT NULL DEFAULT 0,

    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign key to tenants
ALTER TABLE "tenant_usage_snapshots"
  ADD CONSTRAINT "tenant_usage_snapshots_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Unique constraint: one row per tenant per day (idempotent upserts)
ALTER TABLE "tenant_usage_snapshots"
  ADD CONSTRAINT "tenant_usage_snapshots_tenant_id_snapshot_date_key"
    UNIQUE ("tenant_id", "snapshot_date");

-- 5. Indexes for dashboard query patterns
-- Range scans: "show all tenants for date range X"
CREATE INDEX "tenant_usage_snapshots_snapshot_date_idx"
  ON "tenant_usage_snapshots"("snapshot_date");

-- Per-tenant history fetch (most recent first)
CREATE INDEX "tenant_usage_snapshots_tenant_id_snapshot_date_idx"
  ON "tenant_usage_snapshots"("tenant_id", "snapshot_date" DESC);
