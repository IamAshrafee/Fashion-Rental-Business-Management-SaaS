-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "discount_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "discount_type" TEXT;
