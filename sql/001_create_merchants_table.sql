-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create merchants table with geospatial support
CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  website text,
  
  -- Source tracking
  source text NOT NULL CHECK (source IN ('google_places_api', 'manual')),
  source_place_id text,
  chain_name text,
  
  -- Geospatial - using geography for meter-based distance calculations
  coords geography(Point, 4326) NOT NULL,
  
  -- Business info
  payment_methods text[] NOT NULL DEFAULT ARRAY['wechat_pay'],
  business_hours jsonb,
  
  -- Sync metadata
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate Google Places
CREATE UNIQUE INDEX merchants_google_place_unique 
  ON merchants (source_place_id) 
  WHERE source = 'google_places_api' AND source_place_id IS NOT NULL;

-- Spatial index for fast geospatial queries
CREATE INDEX merchants_coords_gix 
  ON merchants USING GIST (coords);

-- Chain lookup index
CREATE INDEX merchants_chain_idx 
  ON merchants (chain_name);

-- Source index for filtering manual vs API entries
CREATE INDEX merchants_source_idx 
  ON merchants (source);

-- Active merchants index
CREATE INDEX merchants_active_idx 
  ON merchants (is_active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_merchants_updated_at 
  BEFORE UPDATE ON merchants 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO merchants (name, address, coords, source, chain_name) VALUES 
('99 Ranch Market - Milpitas', '168 Ranch Dr, Milpitas, CA 95035', ST_SetSRID(ST_MakePoint(-121.9074, 37.4323), 4326)::geography, 'manual', '99 Ranch Market'),
('99 Ranch Market - Cupertino', '10825 N Wolfe Rd, Cupertino, CA 95014', ST_SetSRID(ST_MakePoint(-122.0147, 37.3387), 4326)::geography, 'manual', '99 Ranch Market'),
('H Mart - Santa Clara', '3045 El Camino Real, Santa Clara, CA 95051', ST_SetSRID(ST_MakePoint(-121.9634, 37.3525), 4326)::geography, 'manual', 'H Mart');
