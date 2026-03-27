-- ============================================================================
-- 01_extensions.sql — PostgreSQL Extensions
-- Run ONCE before initial migration
-- ============================================================================

-- UUID generation (fallback — Prisma uses uuid() but this ensures gen_random_uuid is available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Required for EXCLUDE constraints on date_blocks (daterange overlap prevention)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Required for fuzzy text search (trigram matching) on product names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
