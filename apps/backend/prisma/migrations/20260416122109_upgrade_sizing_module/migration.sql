/*
  Warnings:

  - You are about to drop the `product_sizes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `size_measurements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `size_parts` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SizeSchemaStatus" AS ENUM ('draft', 'active', 'deprecated');

-- DropForeignKey
ALTER TABLE "product_sizes" DROP CONSTRAINT "product_sizes_product_id_fkey";

-- DropForeignKey
ALTER TABLE "size_measurements" DROP CONSTRAINT "size_measurements_part_id_fkey";

-- DropForeignKey
ALTER TABLE "size_measurements" DROP CONSTRAINT "size_measurements_product_size_id_fkey";

-- DropForeignKey
ALTER TABLE "size_parts" DROP CONSTRAINT "size_parts_product_size_id_fkey";

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "size_instance_id" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "product_type_id" TEXT,
ADD COLUMN     "size_schema_override_id" TEXT;

-- DropTable
DROP TABLE "product_sizes";

-- DropTable
DROP TABLE "size_measurements";

-- DropTable
DROP TABLE "size_parts";

-- DropEnum
DROP TYPE "FreeSizeType";

-- DropEnum
DROP TYPE "SizeMode";

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "default_size_schema_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_schemas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SizeSchemaStatus" NOT NULL DEFAULT 'draft',
    "definition" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_instances" (
    "id" TEXT NOT NULL,
    "size_schema_id" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "display_label" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_charts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "size_schema_id" TEXT NOT NULL,
    "product_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Size Guide',
    "chartMeta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_chart_rows" (
    "id" TEXT NOT NULL,
    "size_chart_id" TEXT NOT NULL,
    "size_label" TEXT NOT NULL,
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "size_chart_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_types_tenant_id_idx" ON "product_types"("tenant_id");

-- CreateIndex
CREATE INDEX "product_types_default_size_schema_id_idx" ON "product_types"("default_size_schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_tenant_id_slug_key" ON "product_types"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "size_schemas_tenant_id_status_idx" ON "size_schemas"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "size_schemas_tenant_id_code_key" ON "size_schemas"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "size_instances_size_schema_id_idx" ON "size_instances"("size_schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "size_instances_size_schema_id_normalized_key_key" ON "size_instances"("size_schema_id", "normalized_key");

-- CreateIndex
CREATE INDEX "size_charts_tenant_id_idx" ON "size_charts"("tenant_id");

-- CreateIndex
CREATE INDEX "size_charts_size_schema_id_idx" ON "size_charts"("size_schema_id");

-- CreateIndex
CREATE INDEX "size_charts_product_id_idx" ON "size_charts"("product_id");

-- CreateIndex
CREATE INDEX "size_chart_rows_size_chart_id_sort_order_idx" ON "size_chart_rows"("size_chart_id", "sort_order");

-- CreateIndex
CREATE INDEX "storefront_events_tenant_id_event_type_created_at_idx" ON "storefront_events"("tenant_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "storefront_events_product_id_event_type_idx" ON "storefront_events"("product_id", "event_type");

-- CreateIndex
CREATE INDEX "storefront_events_session_id_idx" ON "storefront_events"("session_id");

-- CreateIndex
CREATE INDEX "product_variants_size_instance_id_idx" ON "product_variants"("size_instance_id");

-- CreateIndex
CREATE INDEX "products_product_type_id_idx" ON "products"("product_type_id");

-- CreateIndex
CREATE INDEX "products_size_schema_override_id_idx" ON "products"("size_schema_override_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_size_schema_override_id_fkey" FOREIGN KEY ("size_schema_override_id") REFERENCES "size_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_instance_id_fkey" FOREIGN KEY ("size_instance_id") REFERENCES "size_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_default_size_schema_id_fkey" FOREIGN KEY ("default_size_schema_id") REFERENCES "size_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_instances" ADD CONSTRAINT "size_instances_size_schema_id_fkey" FOREIGN KEY ("size_schema_id") REFERENCES "size_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_size_schema_id_fkey" FOREIGN KEY ("size_schema_id") REFERENCES "size_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "size_chart_rows" ADD CONSTRAINT "size_chart_rows_size_chart_id_fkey" FOREIGN KEY ("size_chart_id") REFERENCES "size_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
