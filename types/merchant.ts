export interface Merchant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  
  // Source tracking
  source: 'google_places_api' | 'manual';
  source_place_id: string | null;
  chain_name: string | null;
  
  // Geospatial
  lat: number;
  lng: number;
  
  // Business info
  payment_methods: string[];
  business_hours: Record<string, any> | null;
  
  // Sync metadata
  last_synced_at: string | null;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantRequest {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  chain_name?: string;
  payment_methods?: string[];
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  business_status?: string;
  permanently_closed?: boolean;
}

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
