import { Client } from '@googlemaps/google-maps-services-js';
import { GooglePlaceResult } from '../types/merchant';

if (!process.env.GOOGLE_PLACES_API_KEY) {
  throw new Error('Missing env.GOOGLE_PLACES_API_KEY');
}

const googleMapsClient = new Client({});

export class GooglePlacesService {
  
  // Search for all locations of a specific chain
  static async searchChainStores(chainName: string, region?: { lat: number; lng: number; radius: number }): Promise<GooglePlaceResult[]> {
    try {
      const searchParams: any = {
        params: {
          query: chainName,
          type: 'store',
          key: process.env.GOOGLE_PLACES_API_KEY!,
        }
      };

      // Add location bias if region is specified
      if (region) {
        searchParams.params.location = `${region.lat},${region.lng}`;
        searchParams.params.radius = region.radius;
      }

      const response = await googleMapsClient.textSearch(searchParams);
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const places: GooglePlaceResult[] = response.data.results
        .filter(place => 
          !place.permanently_closed && 
          place.business_status !== 'CLOSED_PERMANENTLY' &&
          place.geometry?.location
        )
        .map(place => ({
          place_id: place.place_id!,
          name: place.name!,
          formatted_address: place.formatted_address!,
          geometry: {
            location: {
              lat: place.geometry!.location!.lat,
              lng: place.geometry!.location!.lng
            }
          },
          business_status: place.business_status,
          permanently_closed: place.permanently_closed
        }));

      // Handle pagination if there are more results
      let nextPageToken = response.data.next_page_token;
      while (nextPageToken && places.length < 60) { // Limit to 60 results per chain
        // Wait 2 seconds before next page request (Google requirement)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const nextResponse = await googleMapsClient.textSearch({
          params: {
            pagetoken: nextPageToken,
            key: process.env.GOOGLE_PLACES_API_KEY!,
          }
        });

        if (nextResponse.data.status === 'OK') {
          const nextPlaces = nextResponse.data.results
            .filter(place => 
              !place.permanently_closed && 
              place.business_status !== 'CLOSED_PERMANENTLY' &&
              place.geometry?.location
            )
            .map(place => ({
              place_id: place.place_id!,
              name: place.name!,
              formatted_address: place.formatted_address!,
              geometry: {
                location: {
                  lat: place.geometry!.location!.lat,
                  lng: place.geometry!.location!.lng
                }
              },
              business_status: place.business_status,
              permanently_closed: place.permanently_closed
            }));

          places.push(...nextPlaces);
          nextPageToken = nextResponse.data.next_page_token;
        } else {
          break;
        }
      }

      return places;
    } catch (error) {
      console.error(`Error searching for ${chainName}:`, error);
      throw error;
    }
  }

  // Get detailed information about a specific place
  static async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const response = await googleMapsClient.placeDetails({
        params: {
          place_id: placeId,
          fields: ['name', 'formatted_address', 'geometry', 'business_status', 'opening_hours', 'formatted_phone_number', 'website'],
          key: process.env.GOOGLE_PLACES_API_KEY!,
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.result;
    } catch (error) {
      console.error(`Error getting place details for ${placeId}:`, error);
      throw error;
    }
  }
}

// Chain configurations for syncing
export const CHAIN_CONFIGS = [
  {
    name: '99 Ranch Market',
    searchQuery: '99 Ranch Market',
    regions: [
      { lat: 37.7749, lng: -122.4194, radius: 80000 }, // SF Bay Area
      { lat: 34.0522, lng: -118.2437, radius: 80000 }, // Los Angeles
      { lat: 47.6062, lng: -122.3321, radius: 50000 }, // Seattle
      { lat: 40.7128, lng: -74.0060, radius: 50000 }   // New York
    ]
  },
  {
    name: 'H Mart',
    searchQuery: 'H Mart',
    regions: [
      { lat: 37.7749, lng: -122.4194, radius: 80000 }, // SF Bay Area
      { lat: 34.0522, lng: -118.2437, radius: 80000 }, // Los Angeles
      { lat: 40.7128, lng: -74.0060, radius: 80000 },  // New York
      { lat: 41.8781, lng: -87.6298, radius: 50000 }   // Chicago
    ]
  }
] as const;
