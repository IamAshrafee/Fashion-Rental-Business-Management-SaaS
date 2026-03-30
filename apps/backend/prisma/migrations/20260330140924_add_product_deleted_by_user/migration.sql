-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deleted_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
