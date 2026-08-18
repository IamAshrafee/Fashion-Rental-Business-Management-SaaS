-- CreateEnum
CREATE TYPE "BookingVersionDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "OperationsFulfillmentDirection" AS ENUM ('OUTBOUND', 'RETURN', 'INTERNAL_TRANSFER');

-- CreateEnum
CREATE TYPE "OperationsFulfillmentMethod" AS ENUM ('COURIER', 'CUSTOMER_PICKUP', 'INSTANT_DELIVERY', 'STAFF_DELIVERY', 'CUSTOMER_DROPOFF', 'STAFF_PICKUP', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationsFulfillmentStatus" AS ENUM ('PLANNED', 'PREPARING', 'READY', 'AWAITING_HANDOVER', 'IN_CUSTODY', 'IN_TRANSIT', 'ATTEMPTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETURNED_TO_ORIGIN');

-- CreateEnum
CREATE TYPE "FulfillmentAllocationStatus" AS ENUM ('PLANNED', 'READY', 'HANDED_OVER', 'RECEIVED', 'CANCELLED', 'LOST');

-- CreateEnum
CREATE TYPE "StockUnitCustodyType" AS ENUM ('BUSINESS_LOCATION', 'INTERNAL_TRANSFER', 'OUTBOUND_CARRIER', 'CUSTOMER', 'RETURN_CARRIER', 'RECEIVING_AREA', 'SERVICE_PROVIDER', 'QUARANTINE', 'LOST', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CustodyEventReason" AS ENUM ('REGISTERED', 'INTERNAL_TRANSFER', 'OUTBOUND_HANDOVER', 'CUSTOMER_RECEIPT', 'RETURN_HANDOVER', 'RETURN_RECEIPT', 'SERVICE_HANDOVER', 'SERVICE_RETURN', 'QUARANTINED', 'MARKED_LOST', 'RECOVERED', 'MANUAL_CORRECTION');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandoverVerificationMethod" AS ENUM ('STAFF_CONFIRMATION', 'OTP', 'SIGNATURE', 'PROVIDER_EVIDENCE', 'MANAGER_OVERRIDE');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RETURN_IN_PROGRESS', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalStartPolicy" AS ENUM ('SCHEDULED', 'HANDOVER', 'LATER_OF_SCHEDULED_AND_HANDOVER', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReturnTimelinessPolicy" AS ENUM ('CUSTOMER_HANDOVER', 'BUSINESS_RECEIPT');

-- CreateEnum
CREATE TYPE "RentalItemStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RETURNING', 'RETURNED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnIntakeStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReturnIntakeItemOutcome" AS ENUM ('RECEIVED', 'MISSING', 'LOST', 'UNEXPECTED', 'WRONG_ITEM');

-- CreateEnum
CREATE TYPE "FinancialEntryKind" AS ENUM ('RENTAL_CHARGE', 'DELIVERY_CHARGE', 'EXTENSION_CHARGE', 'LATE_CHARGE', 'DAMAGE_CHARGE', 'MISSING_ITEM_CHARGE', 'OTHER_CHARGE', 'DISCOUNT', 'WAIVER', 'CUSTOMER_PAYMENT', 'PAYMENT_REVERSAL', 'DEPOSIT_REQUIREMENT', 'DEPOSIT_COLLECTION', 'DEPOSIT_APPLICATION', 'REFUND_OBLIGATION', 'REFUND_PAYMENT', 'CUSTOMER_CREDIT', 'COURIER_RECEIVABLE', 'COURIER_SETTLEMENT', 'ADJUSTMENT', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "FinancialEntryDirection" AS ENUM ('CUSTOMER_RECEIVABLE', 'CUSTOMER_LIABILITY', 'BUSINESS_CASH_IN', 'BUSINESS_CASH_OUT', 'COURIER_RECEIVABLE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'POSTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED', 'WAIVED');

-- CreateEnum
CREATE TYPE "OperationalExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'ACTION_REQUIRED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationalExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ON_HOLD', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "OperationalTaskType" AS ENUM ('REVIEW_BOOKING', 'READY_CHECK', 'PACK_FULFILLMENT', 'COMPLETE_HANDOVER', 'CONFIRM_PAYMENT', 'START_RETURN', 'RECEIVE_RETURN', 'INSPECT_RETURN', 'REVIEW_CHARGE', 'PROCESS_REFUND', 'RESOLVE_EXCEPTION', 'REASSIGN_ITEM', 'RECONCILE_COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationalTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "OperationalTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BookingCloseCycleType" AS ENUM ('STRICT_CLOSE', 'FORCE_CLOSE', 'REOPEN');

-- CreateEnum
CREATE TYPE "BookingCloseCycleStatus" AS ENUM ('OPEN', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "OperationalEventCategory" AS ENUM ('BOOKING', 'INVENTORY', 'CUSTODY', 'FULFILLMENT', 'HANDOVER', 'RENTAL', 'RETURN', 'INSPECTION', 'FINANCIAL', 'EXCEPTION', 'TASK', 'OVERRIDE', 'SYSTEM');

-- CreateTable
CREATE TABLE "booking_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "decision" "BookingVersionDecision" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_version_id" TEXT NOT NULL,
    "direction" "OperationsFulfillmentDirection" NOT NULL,
    "method" "OperationsFulfillmentMethod" NOT NULL,
    "status" "OperationsFulfillmentStatus" NOT NULL DEFAULT 'PLANNED',
    "origin_location_id" TEXT,
    "destination_location_id" TEXT,
    "origin_snapshot" JSONB,
    "destination_snapshot" JSONB,
    "policy_snapshot" JSONB NOT NULL,
    "scheduled_handover_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "status" "OperationsFulfillmentStatus" NOT NULL DEFAULT 'PLANNED',
    "provider" TEXT,
    "integration_mode" TEXT,
    "provider_reference" TEXT,
    "tracking_number" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "quoted_fee" INTEGER,
    "charged_fee" INTEGER,
    "scheduled_at" TIMESTAMP(3),
    "handover_requested_at" TIMESTAMP(3),
    "carrier_collected_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_provider_event_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "provider_snapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fulfillment_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "status" "FulfillmentAllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "handed_over_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_events_v2" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fulfillment_id" TEXT NOT NULL,
    "normalized_status" "OperationsFulfillmentStatus" NOT NULL,
    "original_status" TEXT,
    "source" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "evidence" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied" BOOLEAN NOT NULL DEFAULT true,
    "ignored_reason" TEXT,

    CONSTRAINT "fulfillment_events_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_unit_custodies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "custody_type" "StockUnitCustodyType" NOT NULL,
    "location_id" TEXT,
    "custodian_ref" TEXT,
    "evidence" JSONB,
    "last_confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_unit_custodies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "fulfillment_id" TEXT,
    "handover_id" TEXT,
    "from_custody_type" "StockUnitCustodyType" NOT NULL,
    "to_custody_type" "StockUnitCustodyType" NOT NULL,
    "from_location_id" TEXT,
    "to_location_id" TEXT,
    "from_custodian_ref" TEXT,
    "to_custodian_ref" TEXT,
    "reason" "CustodyEventReason" NOT NULL,
    "actor_user_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "evidence" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "fulfillment_id" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PLANNED',
    "from_custody_type" "StockUnitCustodyType" NOT NULL,
    "to_custody_type" "StockUnitCustodyType" NOT NULL,
    "verification_method" "HandoverVerificationMethod" NOT NULL,
    "verification_ref" TEXT,
    "evidence" JSONB,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "actual_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "from_custody_type" "StockUnitCustodyType" NOT NULL,
    "to_custody_type" "StockUnitCustodyType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_version_id" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'PLANNED',
    "start_policy" "RentalStartPolicy" NOT NULL,
    "return_timeliness_policy" "ReturnTimelinessPolicy" NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "scheduled_start_at" TIMESTAMP(3) NOT NULL,
    "scheduled_end_at" TIMESTAMP(3) NOT NULL,
    "actual_start_at" TIMESTAMP(3),
    "customer_return_at" TIMESTAMP(3),
    "business_received_at" TIMESTAMP(3),
    "actual_end_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "stock_unit_id" TEXT NOT NULL,
    "status" "RentalItemStatus" NOT NULL DEFAULT 'PLANNED',
    "actual_start_at" TIMESTAMP(3),
    "return_started_at" TIMESTAMP(3),
    "actual_end_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_intakes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "fulfillment_id" TEXT,
    "status" "ReturnIntakeStatus" NOT NULL DEFAULT 'DRAFT',
    "amends_return_intake_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "notes" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_intake_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "return_intake_id" TEXT NOT NULL,
    "expected_assignment_id" TEXT,
    "received_stock_unit_id" TEXT,
    "outcome" "ReturnIntakeItemOutcome" NOT NULL,
    "scanned_identity" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_intake_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT,
    "inspection_id" TEXT,
    "fulfillment_id" TEXT,
    "kind" "FinancialEntryKind" NOT NULL,
    "direction" "FinancialEntryDirection" NOT NULL,
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'POSTED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "actor_user_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "reverses_entry_id" TEXT,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_exceptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "stock_unit_id" TEXT,
    "fulfillment_id" TEXT,
    "financial_entry_id" TEXT,
    "category" TEXT NOT NULL,
    "severity" "OperationalExceptionSeverity" NOT NULL,
    "status" "OperationalExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "source_key" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "assignee_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "due_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "exception_id" TEXT,
    "fulfillment_id" TEXT,
    "stock_unit_id" TEXT,
    "task_type" "OperationalTaskType" NOT NULL,
    "priority" "OperationalTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "OperationalTaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_key" TEXT NOT NULL,
    "team" TEXT,
    "assignee_user_id" TEXT,
    "completed_by_user_id" TEXT,
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completion_evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_close_cycles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "close_type" "BookingCloseCycleType" NOT NULL,
    "status" "BookingCloseCycleStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "gate_snapshot" JSONB NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_close_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "category" "OperationalEventCategory" NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_versions_tenant_id_booking_id_created_at_idx" ON "booking_versions"("tenant_id", "booking_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "booking_versions_actor_user_id_idx" ON "booking_versions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_versions_booking_id_version_key" ON "booking_versions"("booking_id", "version");

-- CreateIndex
CREATE INDEX "fulfillment_groups_tenant_id_booking_id_direction_status_idx" ON "fulfillment_groups"("tenant_id", "booking_id", "direction", "status");

-- CreateIndex
CREATE INDEX "fulfillment_groups_booking_version_id_idx" ON "fulfillment_groups"("booking_version_id");

-- CreateIndex
CREATE INDEX "fulfillment_groups_origin_location_id_idx" ON "fulfillment_groups"("origin_location_id");

-- CreateIndex
CREATE INDEX "fulfillment_groups_destination_location_id_idx" ON "fulfillment_groups"("destination_location_id");

-- CreateIndex
CREATE INDEX "fulfillments_tenant_id_status_scheduled_at_idx" ON "fulfillments"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "fulfillments_group_id_created_at_idx" ON "fulfillments"("group_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillments_provider_provider_reference_idx" ON "fulfillments"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "fulfillments_provider_tracking_number_idx" ON "fulfillments"("provider", "tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillments_tenant_id_idempotency_key_key" ON "fulfillments"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "fulfillment_allocations_tenant_id_stock_unit_id_status_idx" ON "fulfillment_allocations"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "fulfillment_allocations_assignment_id_idx" ON "fulfillment_allocations"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_allocations_fulfillment_id_assignment_id_key" ON "fulfillment_allocations"("fulfillment_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_allocations_fulfillment_id_stock_unit_id_key" ON "fulfillment_allocations"("fulfillment_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "fulfillment_events_v2_tenant_id_occurred_at_idx" ON "fulfillment_events_v2"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_events_v2_fulfillment_id_occurred_at_idx" ON "fulfillment_events_v2"("fulfillment_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_events_v2_fulfillment_id_dedupe_key_key" ON "fulfillment_events_v2"("fulfillment_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_custodies_stock_unit_id_key" ON "stock_unit_custodies"("stock_unit_id");

-- CreateIndex
CREATE INDEX "stock_unit_custodies_tenant_id_custody_type_updated_at_idx" ON "stock_unit_custodies"("tenant_id", "custody_type", "updated_at");

-- CreateIndex
CREATE INDEX "stock_unit_custodies_tenant_id_location_id_custody_type_idx" ON "stock_unit_custodies"("tenant_id", "location_id", "custody_type");

-- CreateIndex
CREATE INDEX "custody_events_tenant_id_stock_unit_id_occurred_at_idx" ON "custody_events"("tenant_id", "stock_unit_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "custody_events_fulfillment_id_idx" ON "custody_events"("fulfillment_id");

-- CreateIndex
CREATE INDEX "custody_events_handover_id_idx" ON "custody_events"("handover_id");

-- CreateIndex
CREATE INDEX "custody_events_actor_user_id_idx" ON "custody_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "custody_events_tenant_id_idempotency_key_key" ON "custody_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "handovers_tenant_id_booking_id_status_created_at_idx" ON "handovers"("tenant_id", "booking_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "handovers_fulfillment_id_idx" ON "handovers"("fulfillment_id");

-- CreateIndex
CREATE INDEX "handovers_actor_user_id_idx" ON "handovers"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_tenant_id_idempotency_key_key" ON "handovers"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "handover_items_tenant_id_stock_unit_id_created_at_idx" ON "handover_items"("tenant_id", "stock_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "handover_items_assignment_id_idx" ON "handover_items"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_items_handover_id_assignment_id_key" ON "handover_items"("handover_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "handover_items_handover_id_stock_unit_id_key" ON "handover_items"("handover_id", "stock_unit_id");

-- CreateIndex
CREATE INDEX "rentals_tenant_id_booking_id_status_idx" ON "rentals"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "rentals_booking_version_id_idx" ON "rentals"("booking_version_id");

-- CreateIndex
CREATE INDEX "rentals_tenant_id_scheduled_end_at_status_idx" ON "rentals"("tenant_id", "scheduled_end_at", "status");

-- CreateIndex
CREATE INDEX "rental_items_tenant_id_stock_unit_id_status_idx" ON "rental_items"("tenant_id", "stock_unit_id", "status");

-- CreateIndex
CREATE INDEX "rental_items_assignment_id_idx" ON "rental_items"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_items_rental_id_assignment_id_key" ON "rental_items"("rental_id", "assignment_id");

-- CreateIndex
CREATE INDEX "return_intakes_tenant_id_booking_id_status_created_at_idx" ON "return_intakes"("tenant_id", "booking_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "return_intakes_fulfillment_id_idx" ON "return_intakes"("fulfillment_id");

-- CreateIndex
CREATE INDEX "return_intakes_actor_user_id_idx" ON "return_intakes"("actor_user_id");

-- CreateIndex
CREATE INDEX "return_intakes_amends_return_intake_id_idx" ON "return_intakes"("amends_return_intake_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_intakes_tenant_id_idempotency_key_key" ON "return_intakes"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "return_intake_items_tenant_id_received_stock_unit_id_idx" ON "return_intake_items"("tenant_id", "received_stock_unit_id");

-- CreateIndex
CREATE INDEX "return_intake_items_expected_assignment_id_idx" ON "return_intake_items"("expected_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_intake_items_return_intake_id_expected_assignment_id_key" ON "return_intake_items"("return_intake_id", "expected_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_reverses_entry_id_key" ON "financial_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "financial_entries_tenant_id_booking_id_effective_at_idx" ON "financial_entries"("tenant_id", "booking_id", "effective_at" DESC);

-- CreateIndex
CREATE INDEX "financial_entries_booking_item_id_idx" ON "financial_entries"("booking_item_id");

-- CreateIndex
CREATE INDEX "financial_entries_inspection_id_idx" ON "financial_entries"("inspection_id");

-- CreateIndex
CREATE INDEX "financial_entries_fulfillment_id_idx" ON "financial_entries"("fulfillment_id");

-- CreateIndex
CREATE INDEX "financial_entries_actor_user_id_idx" ON "financial_entries"("actor_user_id");

-- CreateIndex
CREATE INDEX "financial_entries_tenant_id_kind_status_effective_at_idx" ON "financial_entries"("tenant_id", "kind", "status", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_tenant_id_idempotency_key_key" ON "financial_entries"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "operational_exceptions_tenant_id_status_severity_due_at_idx" ON "operational_exceptions"("tenant_id", "status", "severity", "due_at");

-- CreateIndex
CREATE INDEX "operational_exceptions_tenant_id_booking_id_status_idx" ON "operational_exceptions"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "operational_exceptions_stock_unit_id_idx" ON "operational_exceptions"("stock_unit_id");

-- CreateIndex
CREATE INDEX "operational_exceptions_fulfillment_id_idx" ON "operational_exceptions"("fulfillment_id");

-- CreateIndex
CREATE INDEX "operational_exceptions_financial_entry_id_idx" ON "operational_exceptions"("financial_entry_id");

-- CreateIndex
CREATE INDEX "operational_exceptions_assignee_user_id_status_due_at_idx" ON "operational_exceptions"("assignee_user_id", "status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "operational_exceptions_tenant_id_source_key_key" ON "operational_exceptions"("tenant_id", "source_key");

-- CreateIndex
CREATE INDEX "operational_tasks_tenant_id_status_priority_due_at_idx" ON "operational_tasks"("tenant_id", "status", "priority", "due_at");

-- CreateIndex
CREATE INDEX "operational_tasks_tenant_id_booking_id_status_idx" ON "operational_tasks"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "operational_tasks_exception_id_idx" ON "operational_tasks"("exception_id");

-- CreateIndex
CREATE INDEX "operational_tasks_fulfillment_id_idx" ON "operational_tasks"("fulfillment_id");

-- CreateIndex
CREATE INDEX "operational_tasks_stock_unit_id_idx" ON "operational_tasks"("stock_unit_id");

-- CreateIndex
CREATE INDEX "operational_tasks_assignee_user_id_status_due_at_idx" ON "operational_tasks"("assignee_user_id", "status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "operational_tasks_tenant_id_source_key_key" ON "operational_tasks"("tenant_id", "source_key");

-- CreateIndex
CREATE INDEX "booking_close_cycles_tenant_id_booking_id_status_idx" ON "booking_close_cycles"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_close_cycles_actor_user_id_idx" ON "booking_close_cycles"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_close_cycles_booking_id_cycle_number_key" ON "booking_close_cycles"("booking_id", "cycle_number");

-- CreateIndex
CREATE INDEX "operational_events_tenant_id_booking_id_occurred_at_idx" ON "operational_events"("tenant_id", "booking_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "operational_events_tenant_id_aggregate_type_aggregate_id_oc_idx" ON "operational_events"("tenant_id", "aggregate_type", "aggregate_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "operational_events_actor_user_id_idx" ON "operational_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_events_tenant_id_idempotency_key_key" ON "operational_events"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "booking_versions" ADD CONSTRAINT "booking_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_versions" ADD CONSTRAINT "booking_versions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_versions" ADD CONSTRAINT "booking_versions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_groups" ADD CONSTRAINT "fulfillment_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_groups" ADD CONSTRAINT "fulfillment_groups_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_groups" ADD CONSTRAINT "fulfillment_groups_booking_version_id_fkey" FOREIGN KEY ("booking_version_id") REFERENCES "booking_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_groups" ADD CONSTRAINT "fulfillment_groups_origin_location_id_fkey" FOREIGN KEY ("origin_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_groups" ADD CONSTRAINT "fulfillment_groups_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "fulfillment_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_allocations" ADD CONSTRAINT "fulfillment_allocations_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_events_v2" ADD CONSTRAINT "fulfillment_events_v2_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_events_v2" ADD CONSTRAINT "fulfillment_events_v2_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_custodies" ADD CONSTRAINT "stock_unit_custodies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_custodies" ADD CONSTRAINT "stock_unit_custodies_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_custodies" ADD CONSTRAINT "stock_unit_custodies_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_version_id_fkey" FOREIGN KEY ("booking_version_id") REFERENCES "booking_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intakes" ADD CONSTRAINT "return_intakes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intakes" ADD CONSTRAINT "return_intakes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intakes" ADD CONSTRAINT "return_intakes_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intakes" ADD CONSTRAINT "return_intakes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intakes" ADD CONSTRAINT "return_intakes_amends_return_intake_id_fkey" FOREIGN KEY ("amends_return_intake_id") REFERENCES "return_intakes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intake_items" ADD CONSTRAINT "return_intake_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intake_items" ADD CONSTRAINT "return_intake_items_return_intake_id_fkey" FOREIGN KEY ("return_intake_id") REFERENCES "return_intakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intake_items" ADD CONSTRAINT "return_intake_items_expected_assignment_id_fkey" FOREIGN KEY ("expected_assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_intake_items" ADD CONSTRAINT "return_intake_items_received_stock_unit_id_fkey" FOREIGN KEY ("received_stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "stock_unit_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "financial_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_financial_entry_id_fkey" FOREIGN KEY ("financial_entry_id") REFERENCES "financial_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_exceptions" ADD CONSTRAINT "operational_exceptions_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "operational_exceptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_stock_unit_id_fkey" FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_tasks" ADD CONSTRAINT "operational_tasks_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_close_cycles" ADD CONSTRAINT "booking_close_cycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_close_cycles" ADD CONSTRAINT "booking_close_cycles_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_close_cycles" ADD CONSTRAINT "booking_close_cycles_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks that Prisma cannot express. Amounts use integer minor units.
ALTER TABLE "fulfillments"
  ADD CONSTRAINT "fulfillments_quoted_fee_non_negative" CHECK ("quoted_fee" IS NULL OR "quoted_fee" >= 0),
  ADD CONSTRAINT "fulfillments_charged_fee_non_negative" CHECK ("charged_fee" IS NULL OR "charged_fee" >= 0),
  ADD CONSTRAINT "fulfillments_version_non_negative" CHECK ("version" >= 0);

ALTER TABLE "fulfillment_groups"
  ADD CONSTRAINT "fulfillment_groups_version_non_negative" CHECK ("version" >= 0);

ALTER TABLE "stock_unit_custodies"
  ADD CONSTRAINT "stock_unit_custodies_version_non_negative" CHECK ("version" >= 0),
  ADD CONSTRAINT "stock_unit_custodies_location_required" CHECK (
    "custody_type" NOT IN ('BUSINESS_LOCATION', 'RECEIVING_AREA', 'SERVICE_PROVIDER', 'QUARANTINE')
    OR "location_id" IS NOT NULL
  );

ALTER TABLE "handovers"
  ADD CONSTRAINT "handovers_version_non_negative" CHECK ("version" >= 0),
  ADD CONSTRAINT "handovers_completion_time_required" CHECK ("status" <> 'COMPLETED' OR "actual_at" IS NOT NULL);

ALTER TABLE "rentals"
  ADD CONSTRAINT "rentals_version_non_negative" CHECK ("version" >= 0),
  ADD CONSTRAINT "rentals_scheduled_dates_valid" CHECK ("scheduled_end_at" >= "scheduled_start_at"),
  ADD CONSTRAINT "rentals_active_start_required" CHECK ("status" <> 'ACTIVE' OR "actual_start_at" IS NOT NULL);

ALTER TABLE "return_intakes"
  ADD CONSTRAINT "return_intakes_version_non_negative" CHECK ("version" >= 0),
  ADD CONSTRAINT "return_intakes_completion_time_required" CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);

ALTER TABLE "return_intake_items"
  ADD CONSTRAINT "return_intake_items_identity_required" CHECK (
    ("outcome" IN ('RECEIVED', 'WRONG_ITEM') AND "expected_assignment_id" IS NOT NULL AND "received_stock_unit_id" IS NOT NULL)
    OR ("outcome" IN ('MISSING', 'LOST') AND "expected_assignment_id" IS NOT NULL)
    OR ("outcome" = 'UNEXPECTED' AND "received_stock_unit_id" IS NOT NULL)
  );

ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_entries_currency_code" CHECK (
    char_length("currency") = 3 AND "currency" = upper("currency")
  );

ALTER TABLE "operational_exceptions"
  ADD CONSTRAINT "operational_exceptions_resolution_required" CHECK (
    "status" NOT IN ('RESOLVED', 'WAIVED') OR ("resolved_at" IS NOT NULL AND "resolution" IS NOT NULL)
  );

ALTER TABLE "operational_tasks"
  ADD CONSTRAINT "operational_tasks_completion_required" CHECK (
    "status" <> 'COMPLETED' OR "completed_at" IS NOT NULL
  );

ALTER TABLE "booking_close_cycles"
  ADD CONSTRAINT "booking_close_cycles_number_positive" CHECK ("cycle_number" > 0),
  ADD CONSTRAINT "booking_close_cycles_completion_time_required" CHECK (
    "status" <> 'COMPLETED' OR "closed_at" IS NOT NULL
  );

-- Existing development records receive immutable Version 1 snapshots. The
-- migration never invents approval actors or silently rewrites old facts.
INSERT INTO "booking_versions" (
  "id",
  "tenant_id",
  "booking_id",
  "version",
  "decision",
  "snapshot",
  "reason",
  "approved_at",
  "rejected_at",
  "created_at"
)
SELECT
  'operations-v1-' || b."id",
  b."tenant_id",
  b."id",
  1,
  CASE
    WHEN b."status" = 'pending' THEN 'PENDING'::"BookingVersionDecision"
    WHEN b."status" = 'cancelled' THEN 'SUPERSEDED'::"BookingVersionDecision"
    ELSE 'APPROVED'::"BookingVersionDecision"
  END,
  jsonb_build_object(
    'migratedFromCompatibilityRecord', true,
    'bookingNumber', b."booking_number",
    'channel', b."channel",
    'customerId', b."customer_id",
    'rentalStartDate', b."rental_start_date",
    'rentalEndDate', b."rental_end_date",
    'sourceLocationId', b."source_location_id",
    'handoverMethod', b."handover_method",
    'returnMethod', b."return_method",
    'paymentMethod', b."payment_method",
    'pricing', jsonb_build_object(
      'subtotal', b."subtotal",
      'totalFees', b."total_fees",
      'shippingFee', b."shipping_fee",
      'totalDeposit', b."total_deposit",
      'discountAmount', b."discount_amount",
      'grandTotal', b."grand_total"
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bookingItemId', bi."id",
        'productId', bi."product_id",
        'variantId', bi."variant_id",
        'variantSizeId', bi."variant_size_id",
        'quantity', bi."quantity",
        'productName', bi."product_name",
        'startDate', bi."start_date",
        'endDate', bi."end_date",
        'itemTotal', bi."item_total",
        'depositAmount', bi."deposit_amount"
      ) ORDER BY bi."created_at", bi."id")
      FROM "booking_items" bi
      WHERE bi."booking_id" = b."id"
    ), '[]'::jsonb)
  ),
  'Foundation migration from compatibility booking record',
  b."confirmed_at",
  NULL,
  b."created_at"
FROM "bookings" b;

INSERT INTO "operational_events" (
  "id",
  "tenant_id",
  "booking_id",
  "category",
  "event_type",
  "aggregate_type",
  "aggregate_id",
  "reason",
  "metadata",
  "idempotency_key",
  "occurred_at",
  "received_at"
)
SELECT
  'migration-booking-event-' || b."id",
  b."tenant_id",
  b."id",
  'BOOKING'::"OperationalEventCategory",
  'BOOKING_VERSION_MIGRATED',
  'Booking',
  b."id",
  'Created immutable Version 1 during rental-operations foundation migration',
  jsonb_build_object('bookingVersionId', 'operations-v1-' || b."id", 'version', 1),
  'migration:booking-version:' || b."id",
  b."created_at",
  CURRENT_TIMESTAMP
FROM "bookings" b;

-- Existing physical items receive deterministic current custody. OUT_FOR_RENTAL
-- is intentionally UNKNOWN because the old state cannot prove customer versus
-- carrier possession; those records become critical, owned migration work.
INSERT INTO "stock_unit_custodies" (
  "id",
  "tenant_id",
  "stock_unit_id",
  "custody_type",
  "location_id",
  "custodian_ref",
  "evidence",
  "last_confirmed_at",
  "version",
  "created_at",
  "updated_at"
)
SELECT
  'migration-custody-' || su."id",
  su."tenant_id",
  su."id",
  CASE
    WHEN su."disposition" = 'LOST' THEN 'LOST'::"StockUnitCustodyType"
    WHEN su."disposition" = 'QUARANTINED' THEN 'QUARANTINE'::"StockUnitCustodyType"
    WHEN su."operational_state" = 'OUT_FOR_RENTAL' THEN 'UNKNOWN'::"StockUnitCustodyType"
    WHEN su."operational_state" = 'IN_TRANSFER' THEN 'INTERNAL_TRANSFER'::"StockUnitCustodyType"
    WHEN su."operational_state" IN ('CLEANING', 'WASHING', 'REPAIRING') THEN 'SERVICE_PROVIDER'::"StockUnitCustodyType"
    WHEN su."operational_state" = 'AWAITING_INSPECTION' THEN 'RECEIVING_AREA'::"StockUnitCustodyType"
    ELSE 'BUSINESS_LOCATION'::"StockUnitCustodyType"
  END,
  CASE
    WHEN su."disposition" = 'QUARANTINED'
      OR su."operational_state" IN ('CLEANING', 'WASHING', 'REPAIRING', 'AWAITING_INSPECTION')
      OR (su."disposition" = 'ACTIVE' AND su."operational_state" NOT IN ('OUT_FOR_RENTAL', 'IN_TRANSFER'))
    THEN su."location_id"
    ELSE NULL
  END,
  CASE
    WHEN su."disposition" = 'QUARANTINED'
      OR su."operational_state" IN ('CLEANING', 'WASHING', 'REPAIRING', 'AWAITING_INSPECTION')
      OR (su."disposition" = 'ACTIVE' AND su."operational_state" NOT IN ('OUT_FOR_RENTAL', 'IN_TRANSFER'))
    THEN su."location_id"
    ELSE NULL
  END,
  jsonb_build_object(
    'migratedFromDisposition', su."disposition",
    'migratedFromOperationalState', su."operational_state"
  ),
  su."updated_at",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "stock_units" su
WHERE su."deleted_at" IS NULL;

INSERT INTO "custody_events" (
  "id",
  "tenant_id",
  "stock_unit_id",
  "from_custody_type",
  "to_custody_type",
  "to_location_id",
  "to_custodian_ref",
  "reason",
  "idempotency_key",
  "evidence",
  "occurred_at",
  "received_at"
)
SELECT
  'migration-custody-event-' || c."stock_unit_id",
  c."tenant_id",
  c."stock_unit_id",
  'UNKNOWN'::"StockUnitCustodyType",
  c."custody_type",
  c."location_id",
  c."custodian_ref",
  'MANUAL_CORRECTION'::"CustodyEventReason",
  'migration:custody:' || c."stock_unit_id",
  c."evidence",
  c."last_confirmed_at",
  CURRENT_TIMESTAMP
FROM "stock_unit_custodies" c;

INSERT INTO "operational_exceptions" (
  "id",
  "tenant_id",
  "booking_id",
  "stock_unit_id",
  "category",
  "severity",
  "status",
  "is_blocking",
  "title",
  "description",
  "evidence",
  "source_key",
  "created_at",
  "updated_at"
)
SELECT
  'migration-custody-exception-' || c."stock_unit_id",
  c."tenant_id",
  assignment_booking."booking_id",
  c."stock_unit_id",
  'MIGRATION_CUSTODY',
  'CRITICAL'::"OperationalExceptionSeverity",
  'OPEN'::"OperationalExceptionStatus",
  true,
  'Physical-item custody requires confirmation',
  'The previous OUT_FOR_RENTAL state could not prove whether the customer or a carrier possessed this item.',
  c."evidence",
  'migration:unknown-custody:' || c."stock_unit_id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "stock_unit_custodies" c
JOIN LATERAL (
  SELECT ir."booking_id"
  FROM "stock_unit_assignments" sua
  JOIN "inventory_reservations" ir ON ir."id" = sua."reservation_id"
  WHERE sua."stock_unit_id" = c."stock_unit_id" AND sua."released_at" IS NULL
  ORDER BY sua."assigned_at" DESC, sua."id" DESC
  LIMIT 1
) assignment_booking ON true
WHERE c."custody_type" = 'UNKNOWN';
