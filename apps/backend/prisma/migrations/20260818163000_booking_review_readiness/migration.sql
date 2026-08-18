-- Link Ready Check evidence to the immutable booking terms that it validated.
ALTER TABLE "stock_unit_inspections"
ADD COLUMN "booking_version_id" TEXT;

CREATE INDEX "stock_unit_inspections_booking_version_id_inspection_type_status_idx"
ON "stock_unit_inspections"("booking_version_id", "inspection_type", "status");

ALTER TABLE "stock_unit_inspections"
ADD CONSTRAINT "stock_unit_inspections_booking_version_id_fkey"
FOREIGN KEY ("booking_version_id") REFERENCES "booking_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
