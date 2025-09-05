-- Migration: Change from partial unique index to global unique constraint
-- This allows source_place_id to be unique across all sources, not just Google Places

-- Drop the old partial unique index
DROP INDEX IF EXISTS merchants_google_place_unique;

-- Add global unique constraint on source_place_id
ALTER TABLE merchants 
ADD CONSTRAINT merchants_place_id_unique 
UNIQUE (source_place_id);