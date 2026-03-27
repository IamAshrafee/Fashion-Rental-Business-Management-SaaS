-- ============================================================================
-- 04_indexes.sql — Advanced Indexes (not expressible in Prisma)
-- Run AFTER initial Prisma migration creates the tables
-- ============================================================================

-- Full-text search index (GIN on tsvector)
CREATE INDEX IF NOT EXISTS products_search_idx
  ON products USING gin(search_vector);

-- Fuzzy search index (trigram on product name)
CREATE INDEX IF NOT EXISTS products_trgm_idx
  ON products USING gin(name gin_trgm_ops);

-- Storefront listing — partial index for the most frequent query:
-- "List published, available, non-deleted products for a tenant, sorted by newest"
CREATE INDEX IF NOT EXISTS products_storefront_idx
  ON products (tenant_id, created_at DESC)
  WHERE status = 'published' AND is_available = true AND deleted_at IS NULL;

-- Active bookings — partial index excluding soft-deleted bookings
CREATE INDEX IF NOT EXISTS bookings_active_idx
  ON bookings (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- GiST index for efficient date range overlap queries on date_blocks
CREATE INDEX IF NOT EXISTS date_blocks_overlap_gist
  ON date_blocks USING gist (
    product_id,
    daterange(start_date, end_date, '[]')
  );
