-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'free_tier';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'grace_period';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'suspended';

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "max_orders" INTEGER;
