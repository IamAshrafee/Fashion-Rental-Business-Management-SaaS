-- CreateEnum
CREATE TYPE "ProductCompositionRole" AS ENUM ('MAIN', 'REQUIRED_COMPONENT', 'OPTIONAL_ADDON');

-- CreateEnum
CREATE TYPE "CompositionSkuResolution" AS ENUM ('FIXED', 'CUSTOMER_SELECTED', 'PARENT_DERIVED', 'STAFF_SELECTED');

-- CreateEnum
CREATE TYPE "CompositionSubstitutionPolicy" AS ENUM ('NOT_ALLOWED', 'EQUIVALENT_ONLY', 'STAFF_APPROVAL', 'CUSTOMER_APPROVAL');

-- CreateEnum
CREATE TYPE "CompositionPricingBehavior" AS ENUM ('INCLUDED', 'ADDITIVE', 'OPTIONAL_PRICE');

-- CreateEnum
CREATE TYPE "FulfillmentSelectionSource" AS ENUM ('MAIN_PRODUCT', 'FIXED_RULE', 'CUSTOMER', 'PARENT_DERIVED', 'STAFF', 'SUBSTITUTION', 'LEGACY_BACKFILL');

-- CreateEnum
CREATE TYPE "FulfillmentRequirementStatus" AS ENUM ('PLANNED', 'RESERVED', 'PARTIALLY_ASSIGNED', 'ASSIGNED', 'PARTIALLY_HANDED_OUT', 'HANDED_OUT', 'PARTIALLY_RETURNED', 'RETURNED', 'LOST', 'OVERDUE', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "FulfillmentVersionAction" AS ENUM ('CREATED', 'MODIFIED', 'SUBSTITUTED', 'CANCELLED', 'OVERDUE_EXTENDED', 'RESOLVED_LOST');

-- CreateEnum
CREATE TYPE "FulfillmentApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FulfillmentEventType" AS ENUM ('RESERVED', 'ASSIGNED', 'ASSIGNMENT_RELEASED', 'HANDED_OUT', 'RETURNED', 'MARKED_LOST', 'OVERDUE', 'OVERDUE_RESOLVED', 'CANCELLED');

-- Reservation ownership is backfilled before the new reference becomes required.
ALTER TABLE "inventory_reservations" ADD COLUMN "fulfillment_requirement_id" TEXT;

-- CreateTable
CREATE TABLE "product_composition_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_product_id" TEXT NOT NULL,
    "component_product_id" TEXT,
    "fixed_variant_size_id" TEXT,
    "role" "ProductCompositionRole" NOT NULL,
    "name" TEXT NOT NULL,
    "selection_group_key" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sku_resolution" "CompositionSkuResolution" NOT NULL,
    "substitution_policy" "CompositionSubstitutionPolicy" NOT NULL DEFAULT 'NOT_ALLOWED',
    "pricing_behavior" "CompositionPricingBehavior" NOT NULL DEFAULT 'INCLUDED',
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "allocation_weight" INTEGER NOT NULL DEFAULT 1,
    "is_default_selected" BOOLEAN NOT NULL DEFAULT false,
    "customer_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "compatibility_rules" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "configuration_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_composition_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_composition_alternatives" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "compatibility_rule" JSONB,
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_composition_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "composition_rule_id" TEXT,
    "selected_alternative_id" TEXT,
    "parent_requirement_id" TEXT,
    "requirement_key" TEXT NOT NULL,
    "role" "ProductCompositionRole" NOT NULL,
    "selection_source" "FulfillmentSelectionSource" NOT NULL,
    "status" "FulfillmentRequirementStatus" NOT NULL DEFAULT 'PLANNED',
    "product_id" TEXT,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assigned_quantity" INTEGER NOT NULL DEFAULT 0,
    "handed_out_quantity" INTEGER NOT NULL DEFAULT 0,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "lost_quantity" INTEGER NOT NULL DEFAULT 0,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT,
    "size_snapshot" TEXT,
    "rule_snapshot" JSONB,
    "customer_selection_snapshot" JSONB,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "price_adjustment" INTEGER NOT NULL DEFAULT 0,
    "revenue_allocation" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirement_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" "FulfillmentVersionAction" NOT NULL,
    "product_id" TEXT,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "blocked_start_date" DATE NOT NULL,
    "blocked_end_date" DATE NOT NULL,
    "selection_source" "FulfillmentSelectionSource" NOT NULL,
    "snapshot" JSONB,
    "reason" TEXT NOT NULL,
    "price_impact" INTEGER NOT NULL DEFAULT 0,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_selection_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "composition_rule_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_size_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selected_by" "FulfillmentSelectionSource" NOT NULL,
    "selection_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_selection_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_substitutions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "from_version" INTEGER NOT NULL,
    "to_version" INTEGER NOT NULL,
    "from_product_id" TEXT NOT NULL,
    "from_variant_size_id" TEXT NOT NULL,
    "to_product_id" TEXT NOT NULL,
    "to_variant_size_id" TEXT NOT NULL,
    "compatibility_result" JSONB,
    "approval_status" "FulfillmentApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "customer_approved_at" TIMESTAMP(3),
    "price_impact" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_requirement_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "event_type" "FulfillmentEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "from_status" "FulfillmentRequirementStatus",
    "to_status" "FulfillmentRequirementStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "actor_user_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_requirement_events_pkey" PRIMARY KEY ("id")
);

-- Every legacy booking line receives one explicit MAIN obligation. Existing
-- reservation identity is reused when present; ambiguous legacy product/SKU
-- values remain NULL for owner reconciliation instead of being guessed.
INSERT INTO "fulfillment_requirements" (
    "id", "tenant_id", "booking_id", "booking_item_id", "requirement_key",
    "role", "selection_source", "status", "product_id", "variant_size_id",
    "quantity", "assigned_quantity", "product_name_snapshot",
    "variant_name_snapshot", "size_snapshot", "rule_snapshot",
    "rental_start_date", "rental_end_date", "blocked_start_date",
    "blocked_end_date", "revenue_allocation", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    bi."tenant_id",
    bi."booking_id",
    bi."id",
    'MAIN',
    'MAIN'::"ProductCompositionRole",
    'LEGACY_BACKFILL'::"FulfillmentSelectionSource",
    CASE
      WHEN ir."status" IN ('PENDING', 'CONFIRMED') THEN 'RESERVED'::"FulfillmentRequirementStatus"
      WHEN ir."status" = 'RELEASED' THEN 'RETURNED'::"FulfillmentRequirementStatus"
      WHEN ir."status" IN ('CANCELLED', 'EXPIRED') THEN 'CANCELLED'::"FulfillmentRequirementStatus"
      ELSE 'PLANNED'::"FulfillmentRequirementStatus"
    END,
    COALESCE(ir."product_id", bi."product_id"),
    COALESCE(ir."variant_size_id", bi."variant_size_id"),
    COALESCE(ir."quantity", bi."quantity"),
    COALESCE((
      SELECT COUNT(*)::integer
      FROM "stock_unit_assignments" sua
      WHERE sua."reservation_id" = ir."id" AND sua."released_at" IS NULL
    ), 0),
    bi."product_name",
    bi."variant_name",
    bi."size_info",
    jsonb_build_object('migration', 'legacy-main-requirement'),
    COALESCE(ir."rental_start_date", bi."start_date"),
    COALESCE(ir."rental_end_date", bi."end_date"),
    COALESCE(ir."blocked_start_date", bi."start_date"),
    COALESCE(ir."blocked_end_date", bi."end_date"),
    bi."item_total",
    bi."created_at",
    CURRENT_TIMESTAMP
FROM "booking_items" bi
LEFT JOIN "inventory_reservations" ir ON ir."booking_item_id" = bi."id";

INSERT INTO "fulfillment_requirement_versions" (
    "id", "tenant_id", "requirement_id", "version", "action", "product_id",
    "variant_size_id", "quantity", "rental_start_date", "rental_end_date",
    "blocked_start_date", "blocked_end_date", "selection_source", "snapshot",
    "reason", "created_at"
)
SELECT
    gen_random_uuid()::text,
    fr."tenant_id",
    fr."id",
    1,
    'CREATED'::"FulfillmentVersionAction",
    fr."product_id",
    fr."variant_size_id",
    fr."quantity",
    fr."rental_start_date",
    fr."rental_end_date",
    fr."blocked_start_date",
    fr."blocked_end_date",
    fr."selection_source",
    fr."rule_snapshot",
    'Legacy booking item backfill',
    fr."created_at"
FROM "fulfillment_requirements" fr;

UPDATE "inventory_reservations" ir
SET "fulfillment_requirement_id" = fr."id"
FROM "fulfillment_requirements" fr
WHERE fr."booking_item_id" = ir."booking_item_id"
  AND fr."requirement_key" = 'MAIN';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "inventory_reservations"
    WHERE "fulfillment_requirement_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Fulfillment backfill left inventory reservations without a requirement';
  END IF;
END $$;

DROP INDEX "inventory_reservations_booking_item_id_key";
ALTER TABLE "inventory_reservations"
  ALTER COLUMN "fulfillment_requirement_id" SET NOT NULL;

ALTER TABLE "product_composition_rules"
  ADD CONSTRAINT "product_composition_rules_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "product_composition_rules_allocation_weight_check" CHECK ("allocation_weight" > 0),
  ADD CONSTRAINT "product_composition_rules_fixed_sku_check" CHECK (
    "sku_resolution" <> 'FIXED' OR "fixed_variant_size_id" IS NOT NULL
  );

ALTER TABLE "fulfillment_requirements"
  ADD CONSTRAINT "fulfillment_requirements_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "fulfillment_requirements_counters_check" CHECK (
    "assigned_quantity" >= 0 AND "assigned_quantity" <= "quantity"
    AND "handed_out_quantity" >= 0 AND "handed_out_quantity" <= "quantity"
    AND "returned_quantity" >= 0 AND "lost_quantity" >= 0
    AND "returned_quantity" + "lost_quantity" <= "handed_out_quantity"
  ),
  ADD CONSTRAINT "fulfillment_requirements_dates_check" CHECK (
    "rental_start_date" <= "rental_end_date"
    AND "blocked_start_date" <= "rental_start_date"
    AND "blocked_end_date" >= "rental_end_date"
  );

ALTER TABLE "fulfillment_requirement_versions"
  ADD CONSTRAINT "fulfillment_requirement_versions_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "fulfillment_requirement_versions_dates_check" CHECK (
    "rental_start_date" <= "rental_end_date"
    AND "blocked_start_date" <= "rental_start_date"
    AND "blocked_end_date" >= "rental_end_date"
  );

ALTER TABLE "fulfillment_selection_snapshots"
  ADD CONSTRAINT "fulfillment_selection_snapshots_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "fulfillment_requirement_events"
  ADD CONSTRAINT "fulfillment_requirement_events_quantity_check" CHECK ("quantity" > 0);

-- CreateIndex
CREATE INDEX "product_composition_rules_tenant_id_parent_product_id_is_ac_idx" ON "product_composition_rules"("tenant_id", "parent_product_id", "is_active", "display_order");

-- CreateIndex
CREATE INDEX "product_composition_rules_component_product_id_idx" ON "product_composition_rules"("component_product_id");

-- CreateIndex
CREATE INDEX "product_composition_rules_fixed_variant_size_id_idx" ON "product_composition_rules"("fixed_variant_size_id");

-- CreateIndex
CREATE INDEX "product_composition_rules_created_by_user_id_idx" ON "product_composition_rules"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_composition_rules_parent_product_id_name_key" ON "product_composition_rules"("parent_product_id", "name");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_tenant_id_rule_id_is_activ_idx" ON "product_composition_alternatives"("tenant_id", "rule_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_product_id_idx" ON "product_composition_alternatives"("product_id");

-- CreateIndex
CREATE INDEX "product_composition_alternatives_variant_size_id_idx" ON "product_composition_alternatives"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_composition_alternatives_rule_id_product_id_variant_key" ON "product_composition_alternatives"("rule_id", "product_id", "variant_size_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_tenant_id_booking_id_status_idx" ON "fulfillment_requirements"("tenant_id", "booking_id", "status");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_tenant_id_variant_size_id_status_b_idx" ON "fulfillment_requirements"("tenant_id", "variant_size_id", "status", "blocked_start_date", "blocked_end_date");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_composition_rule_id_idx" ON "fulfillment_requirements"("composition_rule_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_selected_alternative_id_idx" ON "fulfillment_requirements"("selected_alternative_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirements_parent_requirement_id_idx" ON "fulfillment_requirements"("parent_requirement_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirements_booking_item_id_requirement_key_key" ON "fulfillment_requirements"("booking_item_id", "requirement_key");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_versions_tenant_id_requirement_id_c_idx" ON "fulfillment_requirement_versions"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_requirement_versions_actor_user_id_idx" ON "fulfillment_requirement_versions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirement_versions_requirement_id_version_key" ON "fulfillment_requirement_versions"("requirement_id", "version");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_tenant_id_booking_item_id_idx" ON "fulfillment_selection_snapshots"("tenant_id", "booking_item_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_requirement_id_idx" ON "fulfillment_selection_snapshots"("requirement_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_product_id_idx" ON "fulfillment_selection_snapshots"("product_id");

-- CreateIndex
CREATE INDEX "fulfillment_selection_snapshots_variant_size_id_idx" ON "fulfillment_selection_snapshots"("variant_size_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_selection_snapshots_booking_item_id_composition_key" ON "fulfillment_selection_snapshots"("booking_item_id", "composition_rule_id");

-- CreateIndex
CREATE INDEX "fulfillment_substitutions_tenant_id_requirement_id_created__idx" ON "fulfillment_substitutions"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_substitutions_actor_user_id_idx" ON "fulfillment_substitutions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_substitutions_requirement_id_to_version_key" ON "fulfillment_substitutions"("requirement_id", "to_version");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_tenant_id_requirement_id_cre_idx" ON "fulfillment_requirement_events"("tenant_id", "requirement_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_assignment_id_idx" ON "fulfillment_requirement_events"("assignment_id");

-- CreateIndex
CREATE INDEX "fulfillment_requirement_events_actor_user_id_idx" ON "fulfillment_requirement_events"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_requirement_events_tenant_id_idempotency_key_key" ON "fulfillment_requirement_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_fulfillment_requirement_id_key" ON "inventory_reservations"("fulfillment_requirement_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_booking_item_id_idx" ON "inventory_reservations"("booking_item_id");

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_fixed_variant_size_id_fkey" FOREIGN KEY ("fixed_variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_rules" ADD CONSTRAINT "product_composition_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "product_composition_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_composition_alternatives" ADD CONSTRAINT "product_composition_alternatives_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_composition_rule_id_fkey" FOREIGN KEY ("composition_rule_id") REFERENCES "product_composition_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_selected_alternative_id_fkey" FOREIGN KEY ("selected_alternative_id") REFERENCES "product_composition_alternatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_parent_requirement_id_fkey" FOREIGN KEY ("parent_requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirements" ADD CONSTRAINT "fulfillment_requirements_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_versions" ADD CONSTRAINT "fulfillment_requirement_versions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_composition_rule_id_fkey" FOREIGN KEY ("composition_rule_id") REFERENCES "product_composition_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_selection_snapshots" ADD CONSTRAINT "fulfillment_selection_snapshots_variant_size_id_fkey" FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_substitutions" ADD CONSTRAINT "fulfillment_substitutions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "stock_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requirement_events" ADD CONSTRAINT "fulfillment_requirement_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_fulfillment_requirement_id_fkey" FOREIGN KEY ("fulfillment_requirement_id") REFERENCES "fulfillment_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "inventory_service_orders_tenant_completion_idempotency_key" RENAME TO "inventory_service_orders_tenant_id_completion_idempotency_k_key";

-- RenameIndex
ALTER INDEX "inventory_service_orders_tenant_create_idempotency_key" RENAME TO "inventory_service_orders_tenant_id_create_idempotency_key_key";

-- RenameIndex
ALTER INDEX "stock_unit_inspections_tenant_completion_idempotency_key" RENAME TO "stock_unit_inspections_tenant_id_completion_idempotency_key_key";

-- RenameIndex
ALTER INDEX "stock_unit_inspections_tenant_create_idempotency_key" RENAME TO "stock_unit_inspections_tenant_id_create_idempotency_key_key";

-- RenameIndex
ALTER INDEX "stock_unit_issues_tenant_resolution_idempotency_key" RENAME TO "stock_unit_issues_tenant_id_resolution_idempotency_key_key";
