-- Drop the shipped_at column from bookings
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "shipped_at";
