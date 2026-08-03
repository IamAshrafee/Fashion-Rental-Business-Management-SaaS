-- Hybrid inventory foundation. This migration is intentionally additive so
-- existing product and booking reads remain valid during rollout.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "InventoryTrackingMode" AS ENUM ('POOLED', 'SERIALIZED');
CREATE TYPE "StockUnitStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST');
CREATE TYPE "StockConditionGrade" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED');
CREATE TYPE "InventoryReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RELEASED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "InventoryMovementType" AS ENUM (
  'INITIAL_STOCK',
  'POOLED_ADDITION',
  'POOLED_REDUCTION',
  'UNIT_REGISTERED',
  'CONDITION_CHANGED',
  'MAINTENANCE_STARTED',
  'MAINTENANCE_ENDED',
  'UNIT_RETIRED',
  'UNIT_LOST',
  'UNIT_RECOVERED',
  'ADMIN_CORRECTION'
);
CREATE TYPE "InventoryBlockType" AS ENUM ('MANUAL', 'MAINTENANCE', 'LEGACY_BOOKING');

-- AlterTable
ALTER TABLE "variant_sizes"
  ADD COLUMN "tracking_mode" "InventoryTrackingMode" NOT NULL DEFAULT 'POOLED',
  ADD COLUMN "pooled_quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "inventory_version" INTEGER NOT NULL DEFAULT 0;

UPDATE "variant_sizes"
SET "pooled_quantity" = GREATEST("stock_level", 0);

ALTER TABLE "variant_sizes"
  ADD CONSTRAINT "variant_sizes_pooled_quantity_check" CHECK ("pooled_quantity" >= 0),
  ADD CONSTRAINT "variant_sizes_inventory_version_check" CHECK ("inventory_version" >= 0);

ALTER TABLE "booking_items"
  ADD COLUMN "variant_size_id" TEXT,
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "booking_items_quantity_check" CHECK ("quantity" > 0);

-- CreateTable
CREATE TABLE "stock_units" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "variant_size_id" TEXT NOT NULL,
  "asset_code" TEXT NOT NULL,
  "barcode" TEXT,
  "status" "StockUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "condition" "StockConditionGrade" NOT NULL DEFAULT 'GOOD',
  "location_label" TEXT,
  "purchase_date" DATE,
  "purchase_price" INTEGER,
  "notes" TEXT,
  "retired_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_units_purchase_price_check" CHECK ("purchase_price" IS NULL OR "purchase_price" >= 0)
);

CREATE TABLE "inventory_reservations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "booking_item_id" TEXT NOT NULL,
  "product_id" TEXT,
  "variant_size_id" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "rental_start_date" DATE NOT NULL,
  "rental_end_date" DATE NOT NULL,
  "blocked_start_date" DATE NOT NULL,
  "blocked_end_date" DATE NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "release_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_reservations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "inventory_reservations_rental_dates_check" CHECK ("rental_end_date" >= "rental_start_date"),
  CONSTRAINT "inventory_reservations_blocked_dates_check" CHECK ("blocked_end_date" >= "blocked_start_date")
);

CREATE TABLE "stock_unit_assignments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "stock_unit_id" TEXT NOT NULL,
  "assigned_by_user_id" TEXT,
  "blocked_start_date" DATE NOT NULL,
  "blocked_end_date" DATE NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  "release_reason" TEXT,

  CONSTRAINT "stock_unit_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_unit_assignments_dates_check" CHECK ("blocked_end_date" >= "blocked_start_date")
);

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "variant_size_id" TEXT,
  "stock_unit_id" TEXT,
  "movement_type" "InventoryMovementType" NOT NULL,
  "quantity_delta" INTEGER,
  "before_state" JSONB,
  "after_state" JSONB,
  "reason" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_blocks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT,
  "variant_id" TEXT,
  "variant_size_id" TEXT,
  "stock_unit_id" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "block_type" "InventoryBlockType" NOT NULL,
  "reason" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_blocks_dates_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "inventory_blocks_exactly_one_scope_check" CHECK (
    num_nonnulls("product_id", "variant_id", "variant_size_id", "stock_unit_id") = 1
  )
);

-- CreateIndex
CREATE INDEX "variant_sizes_tenant_id_tracking_mode_idx" ON "variant_sizes"("tenant_id", "tracking_mode");
CREATE INDEX "booking_items_variant_size_id_idx" ON "booking_items"("variant_size_id");

CREATE UNIQUE INDEX "stock_units_tenant_id_asset_code_key" ON "stock_units"("tenant_id", "asset_code");
CREATE UNIQUE INDEX "stock_units_tenant_id_barcode_key" ON "stock_units"("tenant_id", "barcode");
CREATE INDEX "stock_units_variant_size_id_idx" ON "stock_units"("variant_size_id");
CREATE INDEX "stock_units_tenant_id_variant_size_id_status_idx" ON "stock_units"("tenant_id", "variant_size_id", "status");

CREATE UNIQUE INDEX "inventory_reservations_booking_item_id_key" ON "inventory_reservations"("booking_item_id");
CREATE INDEX "inventory_reservations_booking_id_idx" ON "inventory_reservations"("booking_id");
CREATE INDEX "inventory_reservations_product_id_idx" ON "inventory_reservations"("product_id");
CREATE INDEX "inventory_reservations_tenant_sku_status_dates_idx"
  ON "inventory_reservations"("tenant_id", "variant_size_id", "status", "blocked_start_date", "blocked_end_date");
CREATE INDEX "inventory_reservations_tenant_status_expires_idx"
  ON "inventory_reservations"("tenant_id", "status", "expires_at");

CREATE INDEX "stock_unit_assignments_reservation_id_released_at_idx"
  ON "stock_unit_assignments"("reservation_id", "released_at");
CREATE INDEX "stock_unit_assignments_tenant_unit_dates_idx"
  ON "stock_unit_assignments"("tenant_id", "stock_unit_id", "blocked_start_date", "blocked_end_date");
CREATE INDEX "stock_unit_assignments_assigned_by_user_id_idx" ON "stock_unit_assignments"("assigned_by_user_id");

CREATE INDEX "inventory_movements_tenant_sku_created_idx"
  ON "inventory_movements"("tenant_id", "variant_size_id", "created_at");
CREATE INDEX "inventory_movements_stock_unit_created_idx" ON "inventory_movements"("stock_unit_id", "created_at");
CREATE INDEX "inventory_movements_actor_user_id_idx" ON "inventory_movements"("actor_user_id");

CREATE INDEX "inventory_blocks_tenant_product_dates_idx"
  ON "inventory_blocks"("tenant_id", "product_id", "start_date", "end_date");
CREATE INDEX "inventory_blocks_tenant_variant_dates_idx"
  ON "inventory_blocks"("tenant_id", "variant_id", "start_date", "end_date");
CREATE INDEX "inventory_blocks_tenant_sku_dates_idx"
  ON "inventory_blocks"("tenant_id", "variant_size_id", "start_date", "end_date");
CREATE INDEX "inventory_blocks_tenant_unit_dates_idx"
  ON "inventory_blocks"("tenant_id", "stock_unit_id", "start_date", "end_date");
CREATE INDEX "inventory_blocks_created_by_user_id_idx" ON "inventory_blocks"("created_by_user_id");

-- Prevent one serialized unit from being assigned to overlapping reservations.
ALTER TABLE "stock_unit_assignments"
  ADD CONSTRAINT "stock_unit_assignments_no_overlap"
  EXCLUDE USING gist (
    "stock_unit_id" WITH =,
    daterange("blocked_start_date", "blocked_end_date", '[]') WITH &&
  ) WHERE ("released_at" IS NULL);

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_variant_size_id_fkey"
  FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_variant_size_id_fkey"
  FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_booking_item_id_fkey"
  FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_size_id_fkey"
  FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_stock_unit_id_fkey"
  FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_unit_assignments" ADD CONSTRAINT "stock_unit_assignments_assigned_by_user_id_fkey"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_size_id_fkey"
  FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_stock_unit_id_fkey"
  FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_variant_size_id_fkey"
  FOREIGN KEY ("variant_size_id") REFERENCES "variant_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_stock_unit_id_fkey"
  FOREIGN KEY ("stock_unit_id") REFERENCES "stock_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_blocks" ADD CONSTRAINT "inventory_blocks_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

