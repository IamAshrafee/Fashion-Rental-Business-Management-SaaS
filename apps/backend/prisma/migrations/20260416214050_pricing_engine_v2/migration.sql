-- CreateEnum
CREATE TYPE "RatePlanType" AS ENUM ('PER_DAY', 'FLAT_PERIOD', 'TIERED_DAILY', 'WEEKLY_MONTHLY', 'PERCENT_RETAIL');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('FEE', 'DEPOSIT', 'DISCOUNT', 'ADDON', 'SURCHARGE');

-- CreateEnum
CREATE TYPE "ComponentVisibility" AS ENUM ('CUSTOMER', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "ChargeTiming" AS ENUM ('AT_BOOKING', 'AT_PICKUP', 'AT_RETURN', 'POST_RETURN');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('CALENDAR_DAYS', 'NIGHTS');

-- CreateEnum
CREATE TYPE "BillingRounding" AS ENUM ('CEIL', 'FLOOR', 'NEAREST');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('EQ', 'IN', 'GTE', 'LTE', 'BETWEEN', 'OVERLAPS');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "policy_version_id" TEXT;

-- CreateTable
CREATE TABLE "pricing_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "duration_mode" "DurationMode" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "billing_rounding" "BillingRounding" NOT NULL DEFAULT 'CEIL',
    "active_policy_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_policy_versions" (
    "id" TEXT NOT NULL,
    "pricing_profile_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ,
    "effective_to" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "snapshot_config" JSONB,
    "late_fee_policy" JSONB,
    "presentation_config" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" TEXT NOT NULL,
    "policy_version_id" TEXT NOT NULL,
    "type" "RatePlanType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_components" (
    "id" TEXT NOT NULL,
    "policy_version_id" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "visibility" "ComponentVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "charge_timing" "ChargeTiming" NOT NULL DEFAULT 'AT_BOOKING',
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "exclusive_group" TEXT,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_sets" (
    "id" TEXT NOT NULL,
    "rate_plan_id" TEXT,
    "component_id" TEXT,

    CONSTRAINT "condition_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" TEXT NOT NULL,
    "condition_set_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "policy_version_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "customer_context" JSONB,
    "selected_addons" JSONB,
    "inputs_hash" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "billable_days" INTEGER NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "deposit_minor" INTEGER NOT NULL,
    "total_due_now_minor" INTEGER NOT NULL,
    "total_due_later_minor" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ComponentVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "metadata" JSONB,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_profiles_product_id_key" ON "pricing_profiles"("product_id");

-- CreateIndex
CREATE INDEX "pricing_profiles_tenant_id_idx" ON "pricing_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "price_policy_versions_pricing_profile_id_status_version_idx" ON "price_policy_versions"("pricing_profile_id", "status", "version" DESC);

-- CreateIndex
CREATE INDEX "rate_plans_policy_version_id_priority_idx" ON "rate_plans"("policy_version_id", "priority" DESC);

-- CreateIndex
CREATE INDEX "price_components_policy_version_id_priority_idx" ON "price_components"("policy_version_id", "priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "condition_sets_rate_plan_id_key" ON "condition_sets"("rate_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_sets_component_id_key" ON "condition_sets"("component_id");

-- CreateIndex
CREATE INDEX "conditions_condition_set_id_idx" ON "conditions"("condition_set_id");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_inputs_hash_idx" ON "quotes"("tenant_id", "inputs_hash");

-- CreateIndex
CREATE INDEX "quote_line_items_quote_id_idx" ON "quote_line_items"("quote_id");

-- CreateIndex
CREATE INDEX "bookings_policy_version_id_idx" ON "bookings"("policy_version_id");

-- AddForeignKey
ALTER TABLE "pricing_profiles" ADD CONSTRAINT "pricing_profiles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_policy_versions" ADD CONSTRAINT "price_policy_versions_pricing_profile_id_fkey" FOREIGN KEY ("pricing_profile_id") REFERENCES "pricing_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_components" ADD CONSTRAINT "price_components_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_sets" ADD CONSTRAINT "condition_sets_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_sets" ADD CONSTRAINT "condition_sets_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "price_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_condition_set_id_fkey" FOREIGN KEY ("condition_set_id") REFERENCES "condition_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "price_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
