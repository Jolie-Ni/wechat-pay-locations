-- Function to get merchants within a bounding box
CREATE OR REPLACE FUNCTION get_merchants_in_bounds(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  phone text,
  website text,
  source text,
  source_place_id text,
  chain_name text,
  lng double precision,
  lat double precision,
  payment_methods text[],
  business_hours jsonb,
  last_synced_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.address,
    m.phone,
    m.website,
    m.source,
    m.source_place_id,
    m.chain_name,
    ST_X(m.coords::geometry) as lng,
    ST_Y(m.coords::geometry) as lat,
    m.payment_methods,
    m.business_hours,
    m.last_synced_at,
    m.is_active,
    m.created_at,
    m.updated_at
  FROM merchants m
  WHERE m.is_active = true
    AND ST_Intersects(
      m.coords::geometry,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get merchants near a point
CREATE OR REPLACE FUNCTION get_merchants_nearby(
  target_lat double precision,
  target_lng double precision,
  radius_meters integer DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  phone text,
  website text,
  source text,
  source_place_id text,
  chain_name text,
  lng double precision,
  lat double precision,
  payment_methods text[],
  business_hours jsonb,
  last_synced_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance_meters double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.address,
    m.phone,
    m.website,
    m.source,
    m.source_place_id,
    m.chain_name,
    ST_X(m.coords::geometry) as lng,
    ST_Y(m.coords::geometry) as lat,
    m.payment_methods,
    m.business_hours,
    m.last_synced_at,
    m.is_active,
    m.created_at,
    m.updated_at,
    ST_Distance(m.coords, ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography) as distance_meters
  FROM merchants m
  WHERE m.is_active = true
    AND ST_DWithin(
      m.coords,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;
