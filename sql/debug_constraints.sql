-- Debug: Check what constraints and indexes exist on merchants table

-- Check all constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'merchants'::regclass;

-- Check all indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'merchants';

-- Check table structure
\d merchants;

