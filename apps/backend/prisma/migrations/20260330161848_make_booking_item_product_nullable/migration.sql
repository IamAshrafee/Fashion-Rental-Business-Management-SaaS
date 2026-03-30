-- DropForeignKey
ALTER TABLE "booking_items" DROP CONSTRAINT "booking_items_product_id_fkey";

-- AlterTable
ALTER TABLE "booking_items" ALTER COLUMN "product_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
