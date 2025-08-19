const { GooglePlacesService, CHAIN_CONFIGS } = require('../lib/google-places');
const { MerchantService } = require('../lib/supabase');

async function syncAllChains() {
  console.log('Starting store sync job...');
  
  for (const chainConfig of CHAIN_CONFIGS) {
    console.log(`\nSyncing ${chainConfig.name}...`);
    
    try {
      const allPlaces = [];
      
      // Search in each region for this chain
      for (const region of chainConfig.regions) {
        console.log(`  Searching in region: ${region.lat}, ${region.lng}`);
        
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
        
        // Rate limiting - wait 2 seconds between region searches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`  Found ${allPlaces.length} unique locations for ${chainConfig.name}`);
      
      // Upsert all places to database
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
        } catch (error) {
          console.error(`    Error upserting ${place.name}:`, error.message);
        }
        
        // Rate limiting between database operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Mark places that are no longer found as inactive
      const activePlaceIds = allPlaces.map(p => p.place_id);
      await MerchantService.markStaleGooglePlaces(chainConfig.name, activePlaceIds);
      
      console.log(`  ✅ Completed sync for ${chainConfig.name}`);
      
    } catch (error) {
      console.error(`  ❌ Error syncing ${chainConfig.name}:`, error.message);
    }
    
    // Wait between chains to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n🎉 Store sync job completed!');
}

// Run if called directly
if (require.main === module) {
  syncAllChains()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Sync job failed:', error);
      process.exit(1);
    });
}

module.exports = { syncAllChains };
