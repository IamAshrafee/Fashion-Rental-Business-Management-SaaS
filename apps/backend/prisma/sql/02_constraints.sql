-- ============================================================================
-- 02_constraints.sql — Database Constraints (not expressible in Prisma)
-- Run AFTER initial Prisma migration creates the tables
-- ============================================================================

-- CRITICAL: Prevent overlapping date blocks for the same product.
-- Two bookings can NOT reserve the same product for overlapping date ranges.
-- Manual blocks (owner overrides) are exempt from this constraint.
ALTER TABLE date_blocks ADD CONSTRAINT no_overlapping_blocks
  EXCLUDE USING gist (
    product_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (block_type != 'manual');

-- Ensure review ratings are between 1 and 5
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check
  CHECK (rating >= 1 AND rating <= 5);
