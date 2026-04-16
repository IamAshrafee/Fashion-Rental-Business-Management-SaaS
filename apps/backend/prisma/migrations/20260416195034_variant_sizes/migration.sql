/*
  Warnings:

  - You are about to drop the column `size_instance_id` on the `product_variants` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_size_instance_id_fkey";

-- DropIndex
DROP INDEX "product_variants_size_instance_id_idx";

-- AlterTable
ALTER TABLE "product_types" ADD COLUMN     "description" VARCHAR(255);

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "size_instance_id";

-- AlterTable
ALTER TABLE "size_schemas" ADD COLUMN     "description" VARCHAR(255),
ADD COLUMN     "schema_type" TEXT NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "variant_sizes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "size_instance_id" TEXT NOT NULL,
    "stock_level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "variant_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variant_sizes_variant_id_idx" ON "variant_sizes"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_sizes_variant_id_size_instance_id_key" ON "variant_sizes"("variant_id", "size_instance_id");

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_size_instance_id_fkey" FOREIGN KEY ("size_instance_id") REFERENCES "size_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
