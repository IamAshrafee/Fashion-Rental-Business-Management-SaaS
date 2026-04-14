-- 1. Migrate any existing 'shipped' bookings to 'confirmed'
UPDATE bookings SET status = 'confirmed' WHERE status = 'shipped';

-- 2. Remove 'shipped' from BookingStatus enum
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'delivered', 'overdue', 'returned', 'inspected', 'completed');
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus" USING ("status"::text::"BookingStatus");
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending';
DROP TYPE "BookingStatus_old";

-- 3. Add new delivery scheduling columns to bookings
ALTER TABLE "bookings" ADD COLUMN "scheduled_pickup_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "delivery_lead_days" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "courier_error_reason" TEXT;

-- 4. Drop pickup_schedule_mode from store_settings
ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "pickup_schedule_mode";
