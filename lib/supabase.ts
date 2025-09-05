import { createClient } from '@supabase/supabase-js';
import { Merchant, CreateMerchantRequest, BoundingBox } from '../types/merchant';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper functions for merchant operations
export class MerchantService {
  
  // Get merchants within a bounding box
  static async getMerchantsInBounds(bbox: BoundingBox, chainFilter?: string): Promise<Merchant[]> {
    let query = supabase
      .rpc('get_merchants_in_bounds', {
        min_lng: bbox.minLng,
        min_lat: bbox.minLat,
        max_lng: bbox.maxLng,
        max_lat: bbox.maxLat
      });

    if (chainFilter && chainFilter !== 'all') {
      query = query.eq('chain_name', chainFilter);
    }

    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch merchants: ${error.message}`);
    }
    
    return data || [];
  }

  // Get merchants near a point
  static async getMerchantsNearby(lat: number, lng: number, radiusMeters: number = 5000): Promise<Merchant[]> {
    const { data, error } = await supabase
      .rpc('get_merchants_nearby', {
        target_lat: lat,
        target_lng: lng,
        radius_meters: radiusMeters
      });

    if (error) {
      throw new Error(`Failed to fetch nearby merchants: ${error.message}`);
    }

    return data || [];
  }

  // Create a new merchant (manual entry)
  static async createMerchant(merchant: CreateMerchantRequest): Promise<Merchant> {
    const { data, error } = await supabase
      .from('merchants')
      .insert({
        name: merchant.name,
        address: merchant.address,
        phone: merchant.phone,
        website: merchant.website,
        coords: `POINT(${merchant.lng} ${merchant.lat})`,
        source: 'manual',
        chain_name: merchant.chain_name,
        payment_methods: merchant.payment_methods || ['wechat_pay']
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create merchant: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create merchant: No data returned');
    }

    // Transform the data to match our Merchant interface
    const transformedData = {
      ...data,
      lat: merchant.lat,  // Use the original coordinates
      lng: merchant.lng
    };

    return transformedData as Merchant;
  }

  // Upsert merchant from Google Places API
  static async upsertGoogleMerchant(place: {
    place_id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    chain_name: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('merchants')
      .upsert({
        source: 'google_places_api',
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        coords: `POINT(${place.lng} ${place.lat})`,
        chain_name: place.chain_name,
        last_synced_at: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'place_id'
      });

    if (error) {
      throw new Error(`Failed to upsert Google merchant: ${error.message}`);
    }
  }

  // Mark stale Google Places as inactive
  static async markStaleGooglePlaces(chainName: string, activePlaceIds: string[], dryRun: boolean = false): Promise<void> {
    if (dryRun) {
      console.log(`[DRY RUN] Would mark stale places as inactive for ${chainName}`);
      return;
    }

    const { error } = await supabase
      .from('merchants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('source', 'google_places_api')
      .eq('chain_name', chainName)
      .not('place_id', 'in', `(${activePlaceIds.map(id => `"${id}"`).join(',')})`);

    if (error) {
      throw new Error(`Failed to mark stale places: ${error.message}`);
    }
  }
}
