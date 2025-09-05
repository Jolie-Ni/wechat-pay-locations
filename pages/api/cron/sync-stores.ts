import { NextApiRequest, NextApiResponse } from 'next';
import { GooglePlacesService, CHAIN_CONFIGS } from '../../../lib/google-places';
import { MerchantService } from '../../../lib/supabase';
import { GooglePlaceResult } from '../../../types/merchant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify this is a cron request (use a secret in production)
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting scheduled store sync...');
    const results = [];

    for (const chainConfig of CHAIN_CONFIGS) {
      console.log(`Syncing ${chainConfig.name}...`);
      
      try {
        const allPlaces: GooglePlaceResult[] = [];
        
        // Search in each region for this chain
        for (const region of chainConfig.regions) {
          const places = await GooglePlacesService.searchChainStores(
            chainConfig.searchQuery,
            region
          );
          
          // Deduplicate by place_id
          for (const place of places) {
            if (!allPlaces.find(p => p.place_id === place.place_id)) {
              allPlaces.push(place);
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Upsert all places to database
        let successCount = 0;
        for (const place of allPlaces) {
          try {
            await MerchantService.upsertGoogleMerchant({
              place_id: place.place_id,
              name: place.name,
              address: place.formatted_address,
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
              chain_name: chainConfig.name
            });
            successCount++;
          } catch (error) {
            console.error(`Error upserting ${place.name}:`, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Mark stale places as inactive
        const activePlaceIds = allPlaces.map(p => p.place_id);
        await MerchantService.markStaleGooglePlaces(chainConfig.name, activePlaceIds, false);
        
        results.push({
          chain: chainConfig.name,
          found: allPlaces.length,
          synced: successCount,
          status: 'success'
        });
        
      } catch (error) {
        console.error(`Error syncing ${chainConfig.name}:`, error);
        results.push({
          chain: chainConfig.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Wait between chains
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('Sync completed');
    
    res.status(200).json({
      success: true,
      message: 'Store sync completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync job failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
