-- CreateEnum
CREATE TYPE "StockUnitDisposition" AS ENUM ('ACTIVE', 'QUARANTINED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "StockUnitOperationalState" AS ENUM ('AVAILABLE', 'PREPARING', 'READY', 'OUT_FOR_RENTAL', 'AWAITING_INSPECTION', 'CLEANING', 'WASHING', 'REPAIRING', 'IN_TRANSFER');

-- CreateEnum
CREATE TYPE "StockUnitInspectionType" AS ENUM ('PRE_RENTAL', 'RETURN', 'PERIODIC', 'SERVICE_COMPLETION');

-- CreateEnum
CREATE TYPE "StockUnitInspectionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "StockUnitInspectionDecision" AS ENUM ('AVAILABLE', 'CLEANING', 'WASHING', 'REPAIR', 'QUARANTINE', 'LOST', 'RETIRE');

-- CreateEnum
CREATE TYPE "InspectionCheckResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "StockUnitIssueSeverity" AS ENUM ('INFO', 'MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StockUnitIssueStatus" AS ENUM ('OPEN', 'IN_SERVICE', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "StockUnitIssueResponsibility" AS ENUM ('UNKNOWN', 'CUSTOMER', 'BUSINESS', 'NORMAL_WEAR', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "InventoryServiceOrderType" AS ENUM ('PREPARATION', 'CLEANING', 'WASHING', 'REPAIR', 'ALTERATION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "InventoryServiceOrderStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "StockUnitComponentPresence" AS ENUM ('PRESENT', 'MISSING', 'DAMAGED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InventoryMediaPurpose" AS ENUM ('UNIT_REFERENCE', 'PRE_RENTAL', 'POST_RETURN', 'DAMAGE', 'SERVICE', 'CHECKLIST', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockConditionGrade" ADD VALUE 'NEW';
ALTER TYPE "StockConditionGrade" ADD VALUE 'POOR';

-- AlterTable
ALTER TABLE "damage_reports" ADD COLUMN     "stock_unit_issue_id" TEXT;

-- AlterTable
ALTER TABLE "stock_units" ADD COLUMN     "disposition" "StockUnitDisposition" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "operational_state" "StockUnitOperationalState" NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE "stock_unit_lifecycle_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "inspection_id" TEXT,
    "service_order_id" TEXT,
    "issue_id" TEXT,
    "actor_user_id" TEXT,
    "from_disposition" "StockUnitDisposition" NOT NULL,
    "to_disposition" "StockUnitDisposition" NOT NULL,
    "from_operational_state" "StockUnitOperationalState" NOT NULL,
    "to_operational_state" "StockUnitOperationalState" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_inspections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "booking_item_id" TEXT,
    "assignment_id" TEXT,
    "service_order_id" TEXT,
    "inventory_block_id" TEXT,
    "inspection_type" "StockUnitInspectionType" NOT NULL,
    "status" "StockUnitInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "condition_before" "StockConditionGrade" NOT NULL,
    "condition_after" "StockConditionGrade",
    "decision" "StockUnitInspectionDecision",
    "notes" TEXT,
    "customer_liability_note" TEXT,
    "inspected_by_user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "amends_inspection_id" TEXT,
    "create_idempotency_key" TEXT,
    "completion_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_unit_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_inspection_checks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "set_component_definition_id" TEXT,
    "label_snapshot" TEXT NOT NULL,
    "expected_quantity" INTEGER NOT NULL DEFAULT 1,
    "observed_quantity" INTEGER,
    "result" "InspectionCheckResult" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_inspection_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "inspection_id" TEXT,
    "booking_item_id" TEXT,
    "assignment_id" TEXT,
    "issue_type" TEXT NOT NULL,
    "severity" "StockUnitIssueSeverity" NOT NULL,
    "status" "StockUnitIssueStatus" NOT NULL DEFAULT 'OPEN',
    "responsibility" "StockUnitIssueResponsibility" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,
    "is_availability_blocking" BOOLEAN NOT NULL DEFAULT true,
    "estimated_cost" INTEGER,
    "customer_charge" INTEGER,
    "reported_by_user_id" TEXT NOT NULL,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "resolution_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_unit_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_service_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "source_inspection_id" TEXT,
    "inventory_block_id" TEXT,
    "service_type" "InventoryServiceOrderType" NOT NULL,
    "status" "InventoryServiceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "is_availability_blocking" BOOLEAN NOT NULL DEFAULT true,
    "provider_name" TEXT,
    "location_label" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "completed_by_user_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_start_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "expected_completion_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cost" INTEGER,
    "notes" TEXT,
    "completion_outcome" TEXT,
    "create_idempotency_key" TEXT,
    "completion_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_set_component_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_size_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required_quantity" INTEGER NOT NULL DEFAULT 1,
    "inspection_guidance" TEXT,
    "absence_blocks_rental" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_set_component_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_component_states" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "set_component_definition_id" TEXT NOT NULL,
    "presence" "StockUnitComponentPresence" NOT NULL DEFAULT 'PRESENT',
    "present_quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "StockConditionGrade",
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_unit_component_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_media_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT,
    "inspection_id" TEXT,
    "inspection_check_id" TEXT,
    "issue_id" TEXT,
    "service_order_id" TEXT,
    "purpose" "InventoryMediaPurpose" NOT NULL,
    "url" TEXT NOT NULL,
    "object_key" TEXT,
    "mime_type" TEXT,
    "caption" TEXT,
    "is_public_approved" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_user_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_media_attachments_pkey" PRIMARY KEY ("id")
);

-- Preserve the legacy unit lifecycle while the compatibility status remains readable.
UPDATE "stock_units"
SET
    "disposition" = CASE
        WHEN "status" = 'RETIRED' THEN 'RETIRED'::"StockUnitDisposition"
        WHEN "status" = 'LOST' THEN 'LOST'::"StockUnitDisposition"
        ELSE 'ACTIVE'::"StockUnitDisposition"
    END,
    "operational_state" = CASE
        WHEN "status" = 'MAINTENANCE' THEN 'REPAIRING'::"StockUnitOperationalState"
        ELSE 'AVAILABLE'::"StockUnitOperationalState"
    END;

-- Existing maintenance blocks are reused. A conservative open-ended block is created
-- only when the previous implementation did not already create one.
INSERT INTO "inventory_blocks" (
    "id", "tenant_id", "stock_unit_id", "start_date", "end_date", "block_type",
    "reason", "created_by_user_id", "created_at", "updated_at"
)
SELECT
    md5('rental-item-maintenance-block:' || su."id"),
    su."tenant_id",
    su."id",
    CURRENT_DATE,
    DATE '9999-12-31',
    'MAINTENANCE'::"InventoryBlockType",
    'Migrated from legacy stock-unit maintenance status',
    t."owner_user_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "stock_units" su
JOIN "tenants" t ON t."id" = su."tenant_id"
WHERE su."status" = 'MAINTENANCE'
  AND NOT EXISTS (
      SELECT 1
      FROM "inventory_blocks" ib
      WHERE ib."tenant_id" = su."tenant_id"
        AND ib."stock_unit_id" = su."id"
        AND ib."block_type" = 'MAINTENANCE'
        AND ib."end_date" >= CURRENT_DATE
  );

INSERT INTO "inventory_service_orders" (
    "id", "tenant_id", "stock_unit_id", "inventory_block_id", "service_type", "status",
    "is_availability_blocking", "requested_by_user_id", "requested_at", "started_at",
    "notes", "created_at", "updated_at"
)
SELECT
    md5('rental-item-maintenance-service:' || su."id"),
    su."tenant_id",
    su."id",
    ib."id",
    'MAINTENANCE'::"InventoryServiceOrderType",
    'IN_PROGRESS'::"InventoryServiceOrderStatus",
    true,
    t."owner_user_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'Migrated from legacy stock-unit maintenance status',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "stock_units" su
JOIN "tenants" t ON t."id" = su."tenant_id"
JOIN LATERAL (
    SELECT candidate."id"
    FROM "inventory_blocks" candidate
    WHERE candidate."tenant_id" = su."tenant_id"
      AND candidate."stock_unit_id" = su."id"
      AND candidate."block_type" = 'MAINTENANCE'
      AND candidate."end_date" >= CURRENT_DATE
    ORDER BY candidate."created_at" DESC
    LIMIT 1
) ib ON true
WHERE su."status" = 'MAINTENANCE';

INSERT INTO "stock_unit_lifecycle_events" (
    "id", "tenant_id", "stock_unit_id", "actor_user_id", "from_disposition",
    "to_disposition", "from_operational_state", "to_operational_state", "reason", "metadata", "created_at"
)
SELECT
    md5('rental-item-lifecycle-migration:' || su."id"),
    su."tenant_id",
    su."id",
    t."owner_user_id",
    su."disposition",
    su."disposition",
    'AVAILABLE'::"StockUnitOperationalState",
    su."operational_state",
    'Migrated legacy stock-unit lifecycle state',
    jsonb_build_object('legacyStatus', su."status"::text),
    CURRENT_TIMESTAMP
FROM "stock_units" su
JOIN "tenants" t ON t."id" = su."tenant_id"
WHERE su."status" <> 'ACTIVE';

ALTER TABLE "stock_unit_inspection_checks"
    ADD CONSTRAINT "stock_unit_inspection_checks_quantity_check"
    CHECK ("expected_quantity" > 0 AND ("observed_quantity" IS NULL OR "observed_quantity" >= 0));

ALTER TABLE "stock_unit_issues"
    ADD CONSTRAINT "stock_unit_issues_cost_check"
    CHECK (("estimated_cost" IS NULL OR "estimated_cost" >= 0) AND ("customer_charge" IS NULL OR "customer_charge" >= 0));

ALTER TABLE "inventory_service_orders"
    ADD CONSTRAINT "inventory_service_orders_cost_check"
    CHECK ("cost" IS NULL OR "cost" >= 0),
    ADD CONSTRAINT "inventory_service_orders_dates_check"
    CHECK (
        ("scheduled_start_at" IS NULL OR "expected_completion_at" IS NULL OR "scheduled_start_at" <= "expected_completion_at")
        AND ("started_at" IS NULL OR "completed_at" IS NULL OR "started_at" <= "completed_at")
    );

ALTER TABLE "sku_set_component_definitions"
    ADD CONSTRAINT "sku_set_component_definitions_quantity_check"
    CHECK ("required_quantity" > 0);

ALTER TABLE "stock_unit_component_states"
    ADD CONSTRAINT "stock_unit_component_states_quantity_check"
    CHECK ("present_quantity" >= 0);

ALTER TABLE "stock_unit_inspections"
    ADD CONSTRAINT "stock_unit_inspections_completion_check"
    CHECK (
        ("status" = 'DRAFT' AND "completed_at" IS NULL)
        OR
        ("status" IN ('COMPLETED', 'SUPERSEDED') AND "completed_at" IS NOT NULL AND "condition_after" IS NOT NULL AND "decision" IS NOT NULL)
    );

ALTER TABLE "inventory_media_attachments"
    ADD CONSTRAINT "inventory_media_attachments_one_parent_check"
    CHECK (num_nonnulls("stock_unit_id", "inspection_id", "inspection_check_id", "issue_id", "service_order_id") = 1);

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_tenant_id_stock_unit_id_created_idx" ON "stock_unit_lifecycle_events"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_assignment_id_idx" ON "stock_unit_lifecycle_events"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_inspection_id_idx" ON "stock_unit_lifecycle_events"("inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_service_order_id_idx" ON "stock_unit_lifecycle_events"("service_order_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_issue_id_idx" ON "stock_unit_lifecycle_events"("issue_id");

-- CreateIndex
CREATE INDEX "stock_unit_lifecycle_events_actor_user_id_idx" ON "stock_unit_lifecycle_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_lifecycle_events_tenant_id_idempotency_key_key" ON "stock_unit_lifecycle_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_tenant_id_stock_unit_id_created_at_idx" ON "stock_unit_inspections"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_unit_inspections_booking_item_id_idx" ON "stock_unit_inspections"("booking_item_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_assignment_id_idx" ON "stock_unit_inspections"("assignment_id");

CREATE INDEX "stock_unit_inspections_service_order_id_idx" ON "stock_unit_inspections"("service_order_id");

CREATE UNIQUE INDEX "stock_unit_inspections_inventory_block_id_key" ON "stock_unit_inspections"("inventory_block_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_inspected_by_user_id_idx" ON "stock_unit_inspections"("inspected_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspections_amends_inspection_id_idx" ON "stock_unit_inspections"("amends_inspection_id");

CREATE UNIQUE INDEX "stock_unit_inspections_tenant_create_idempotency_key" ON "stock_unit_inspections"("tenant_id", "create_idempotency_key");

CREATE UNIQUE INDEX "stock_unit_inspections_tenant_completion_idempotency_key" ON "stock_unit_inspections"("tenant_id", "completion_idempotency_key");

-- CreateIndex
CREATE INDEX "stock_unit_inspection_checks_tenant_id_inspection_id_idx" ON "stock_unit_inspection_checks"("tenant_id", "inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_inspection_checks_set_component_definition_id_idx" ON "stock_unit_inspection_checks"("set_component_definition_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_tenant_id_stock_unit_id_status_idx" ON "stock_unit_issues"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "stock_unit_issues_inspection_id_idx" ON "stock_unit_issues"("inspection_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_booking_item_id_idx" ON "stock_unit_issues"("booking_item_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_assignment_id_idx" ON "stock_unit_issues"("assignment_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_reported_by_user_id_idx" ON "stock_unit_issues"("reported_by_user_id");

-- CreateIndex
CREATE INDEX "stock_unit_issues_resolved_by_user_id_idx" ON "stock_unit_issues"("resolved_by_user_id");

CREATE UNIQUE INDEX "stock_unit_issues_tenant_resolution_idempotency_key" ON "stock_unit_issues"("tenant_id", "resolution_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_service_orders_inventory_block_id_key" ON "inventory_service_orders"("inventory_block_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_tenant_id_stock_unit_id_status_idx" ON "inventory_service_orders"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "inventory_service_orders_issue_id_idx" ON "inventory_service_orders"("issue_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_source_inspection_id_idx" ON "inventory_service_orders"("source_inspection_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_requested_by_user_id_idx" ON "inventory_service_orders"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_completed_by_user_id_idx" ON "inventory_service_orders"("completed_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_service_orders_tenant_id_expected_completion_at_idx" ON "inventory_service_orders"("tenant_id", "expected_completion_at");

CREATE UNIQUE INDEX "inventory_service_orders_tenant_create_idempotency_key" ON "inventory_service_orders"("tenant_id", "create_idempotency_key");

CREATE UNIQUE INDEX "inventory_service_orders_tenant_completion_idempotency_key" ON "inventory_service_orders"("tenant_id", "completion_idempotency_key");

-- One blocking operational workflow may control a physical unit at a time.
CREATE UNIQUE INDEX "inventory_service_orders_one_blocking_active_per_unit"
ON "inventory_service_orders"("tenant_id", "stock_unit_id")
WHERE "is_availability_blocking" = true AND "status" IN ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS');

-- CreateIndex
CREATE INDEX "sku_set_component_definitions_tenant_id_variant_size_id_is__idx" ON "sku_set_component_definitions"("tenant_id", "variant_size_id", "is_active");

-- CreateIndex
CREATE INDEX "sku_set_component_definitions_created_by_user_id_idx" ON "sku_set_component_definitions"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sku_set_component_definitions_variant_size_id_name_key" ON "sku_set_component_definitions"("variant_size_id", "name");

-- CreateIndex
CREATE INDEX "stock_unit_component_states_tenant_id_stock_unit_id_idx" ON "stock_unit_component_states"("tenant_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "stock_unit_component_states_set_component_definition_id_idx" ON "stock_unit_component_states"("set_component_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_component_states_stock_unit_id_set_component_def_key" ON "stock_unit_component_states"("stock_unit_id", "set_component_definition_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_tenant_id_stock_unit_id_created_idx" ON "inventory_media_attachments"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_media_attachments_inspection_id_idx" ON "inventory_media_attachments"("inspection_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_inspection_check_id_idx" ON "inventory_media_attachments"("inspection_check_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_issue_id_idx" ON "inventory_media_attachments"("issue_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_service_order_id_idx" ON "inventory_media_attachments"("service_order_id");

-- CreateIndex
CREATE INDEX "inventory_media_attachments_uploaded_by_user_id_idx" ON "inventory_media_attachments"("uploaded_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "damage_reports_stock_unit_issue_id_key" ON "damage_reports"("stock_unit_issue_id");

-- CreateIndex
CREATE INDEX "stock_units_tenant_id_variant_size_id_disposition_operation_idx" ON "stock_units"("tenant_id", "variant_size_id", "disposition", "operational_state");

-- AddForeignKey
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_stock_unit_issue_id_fkey" FOREIGN KEY ("stock_unit_issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_lifecycle_events" ADD CONSTRAINT "stock_unit_lifecycle_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_inventory_block_id_fkey" FOREIGN KEY ("inventory_block_id") REFERENCES "inventory_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_inspected_by_user_id_fkey" FOREIGN KEY ("inspected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspections" ADD CONSTRAINT "stock_unit_inspections_amends_inspection_id_fkey" FOREIGN KEY ("amends_inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_inspection_checks" ADD CONSTRAINT "stock_unit_inspection_checks_set_component_definition_id_fkey" FOREIGN KEY ("set_component_definition_id") REFERENCES "sku_set_component_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_issues" ADD CONSTRAINT "stock_unit_issues_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_source_inspection_id_fkey" FOREIGN KEY ("source_inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_inventory_block_id_fkey" FOREIGN KEY ("inventory_block_id") REFERENCES "inventory_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_service_orders" ADD CONSTRAINT "inventory_service_orders_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_set_component_definitions" ADD CONSTRAINT "sku_set_component_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_component_states" ADD CONSTRAINT "stock_unit_component_states_set_component_definition_id_fkey" FOREIGN KEY ("set_component_definition_id") REFERENCES "sku_set_component_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_inspection_check_id_fkey" FOREIGN KEY ("inspection_check_id") REFERENCES "stock_unit_inspection_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "stock_unit_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "inventory_service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_media_attachments" ADD CONSTRAINT "inventory_media_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "inventory_blocks_tenant_product_dates_idx" RENAME TO "inventory_blocks_tenant_id_product_id_start_date_end_date_idx";

-- RenameIndex
ALTER INDEX "inventory_blocks_tenant_sku_dates_idx" RENAME TO "inventory_blocks_tenant_id_variant_size_id_start_date_end_d_idx";

-- RenameIndex
ALTER INDEX "inventory_blocks_tenant_unit_dates_idx" RENAME TO "inventory_blocks_tenant_id_stock_unit_id_start_date_end_dat_idx";

-- RenameIndex
ALTER INDEX "inventory_blocks_tenant_variant_dates_idx" RENAME TO "inventory_blocks_tenant_id_variant_id_start_date_end_date_idx";

-- RenameIndex
ALTER INDEX "inventory_movements_stock_unit_created_idx" RENAME TO "inventory_movements_stock_unit_id_created_at_idx";

-- RenameIndex
ALTER INDEX "inventory_movements_tenant_sku_created_idx" RENAME TO "inventory_movements_tenant_id_variant_size_id_created_at_idx";

-- RenameIndex
ALTER INDEX "inventory_reservations_tenant_sku_status_dates_idx" RENAME TO "inventory_reservations_tenant_id_variant_size_id_status_blo_idx";

-- RenameIndex
ALTER INDEX "inventory_reservations_tenant_status_expires_idx" RENAME TO "inventory_reservations_tenant_id_status_expires_at_idx";

-- RenameIndex
ALTER INDEX "stock_unit_assignments_tenant_unit_dates_idx" RENAME TO "stock_unit_assignments_tenant_id_stock_unit_id_blocked_star_idx";
