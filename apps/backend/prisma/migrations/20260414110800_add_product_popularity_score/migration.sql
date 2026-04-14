-- AlterTable
ALTER TABLE "products" ADD COLUMN     "popularity_score" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_tenant_id_status_popularity_score_idx" ON "products"("tenant_id", "status", "popularity_score");
