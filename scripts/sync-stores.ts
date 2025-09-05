import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GooglePlacesService, CHAIN_CONFIGS } from '../lib/google-places';
import { MerchantService } from '../lib/supabase';
import { GooglePlaceResult } from '../types/merchant';
import { filterPlacesByCity, SUPPORTED_CITIES } from '../lib/cities';

const DRY_RUN = process.env.DRY_RUN === 'true';

if (DRY_RUN) {
  console.log('🧪 DRY RUN MODE - No data will be written to database\n');
}

async function syncAllChains(dryRun = false) {
  console.log('Starting store sync job...');
  
  for (const chainConfig of CHAIN_CONFIGS) {
    console.log(`\nSyncing ${chainConfig.name}...`);
    
    try {
      const allPlaces: GooglePlaceResult[] = [];
      
      // Search in each region for this chain
      for (const region of chainConfig.regions) {
        console.log(`  Searching in region: ${region.name}`);
        
        const places = await GooglePlacesService.searchChainStores(
          chainConfig.searchQuery,
          region
        );
        
        // ADD THIS: Find the matching city and filter places by bounds
        const city = SUPPORTED_CITIES.find(c => 
          c.search.center.lat === region.lat && c.search.center.lng === region.lng
        );

        const filteredPlaces = city ? filterPlacesByCity(places, city) : places;

        // Use filteredPlaces instead of places for deduplication
        for (const place of filteredPlaces) {
          if (!allPlaces.find(p => p.place_id === place.place_id)) {
            allPlaces.push(place);
          }
        }
        
        // Rate limiting - wait 2 seconds between region searches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`  Found ${allPlaces.length} unique locations for ${chainConfig.name}`);
      
      // Upsert all places to database
      let syncCount = 0;
      for (const place of allPlaces) {
        try {
          if (dryRun) {
            console.log(`    [DRY RUN] Would upsert: ${place.name} - ${place.formatted_address}`);
            syncCount++;
          } else {
            await MerchantService.upsertGoogleMerchant({
              place_id: place.place_id,
              name: place.name,
              address: place.formatted_address,
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
              chain_name: chainConfig.name
            });
            syncCount++;
          }
        } catch (error) {
          console.error(`    Error upserting ${place.name}:`, error instanceof Error ? error.message : String(error));
        }
        
        // Rate limiting between database operations
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Mark places that are no longer found as inactive
      const activePlaceIds = allPlaces.map(p => p.place_id);
      await MerchantService.markStaleGooglePlaces(chainConfig.name, activePlaceIds, dryRun);
      
      console.log(`  ✅ ${dryRun ? 'Would sync' : 'Synced'} ${syncCount} locations for ${chainConfig.name}`);
      
    } catch (error) {
      console.error(`  ❌ Error syncing ${chainConfig.name}:`, error instanceof Error ? error.message : String(error));
    }
    
    // Wait between chains to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log(`\n🎉 Store sync job ${dryRun ? 'DRY RUN ' : ''}completed!`);
}

// Run if called directly
if (require.main === module) {
  syncAllChains(DRY_RUN)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Sync job failed:', error);
      process.exit(1);
    });
}

export { syncAllChains };
