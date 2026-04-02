-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "courier_consignment_id" TEXT,
ADD COLUMN     "courier_status" TEXT,
ADD COLUMN     "courier_status_history" JSONB,
ADD COLUMN     "pickup_job_id" TEXT,
ADD COLUMN     "pickup_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "pathao_client_id" TEXT,
ADD COLUMN     "pathao_client_secret" TEXT,
ADD COLUMN     "pathao_password" TEXT,
ADD COLUMN     "pathao_store_id" INTEGER,
ADD COLUMN     "pathao_username" TEXT,
ADD COLUMN     "pickup_city" TEXT,
ADD COLUMN     "pickup_lead_days" INTEGER DEFAULT 2,
ADD COLUMN     "pickup_lead_days_config" JSONB,
ADD COLUMN     "pickup_schedule_mode" TEXT DEFAULT 'fixed';

-- CreateIndex
CREATE INDEX "bookings_tenant_id_courier_status_idx" ON "bookings"("tenant_id", "courier_status");
