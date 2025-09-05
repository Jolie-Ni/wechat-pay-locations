import { Client } from '@googlemaps/google-maps-services-js';
import { GooglePlaceResult } from '../types/merchant';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!process.env.GOOGLE_PLACES_API_KEY) {
  throw new Error('Missing env.GOOGLE_PLACES_API_KEY');
}

const googleMapsClient = new Client({});

export class GooglePlacesService {
  
  // Search for all locations of a specific chain
  static async searchChainStores(
    chainName: string, 
    region?: { lat: number; lng: number; radius: number },
    cityId?: string // Optional: filter by specific city
  ): Promise<GooglePlaceResult[]> {
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

      let places: GooglePlaceResult[] = GooglePlacesService.filterAndTransformPlaces(
        response.data.results, 
        chainName
      );

      // Handle pagination if there are more results
      let nextPageToken = response.data.next_page_token;
      while (nextPageToken && places.length < 60) { // Limit to 60 results per chain
        // Wait 2 seconds before next page request (Google requirement)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const nextResponse = await googleMapsClient.textSearch({
          params: {
            query: chainName, // Required parameter for text search
            pagetoken: nextPageToken,
            key: process.env.GOOGLE_PLACES_API_KEY!,
          }
        });

        if (nextResponse.data.status === 'OK') {
          const nextPlaces = GooglePlacesService.filterAndTransformPlaces(
            nextResponse.data.results, 
            chainName
          );

          places.push(...nextPlaces);
          nextPageToken = nextResponse.data.next_page_token;
        } else {
          break;
        }
      }

      // After getting places, filter by city bounds if cityId is provided
      if (cityId) {
        const city = SUPPORTED_CITIES.find(c => c.id === cityId);
        if (city) {
          places = filterPlacesByCity(places, city);
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

  // Helper function to filter and transform Google Places results
  private static filterAndTransformPlaces(places: any[], chainName: string): GooglePlaceResult[] {
    return places
      .filter(place => 
        !place.permanently_closed && 
        place.business_status !== 'CLOSED_PERMANENTLY' &&
        place.geometry?.location
      )
      .filter(place => GooglePlacesService.isLikelyChainStore(place, chainName))
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
  }

  // Add this generic method to GooglePlacesService
  private static isLikelyChainStore(place: any, expectedChainName: string): boolean {
    const placeName = place.name?.toLowerCase() || '';
    const expectedName = expectedChainName.toLowerCase();
    
    return placeName.startsWith(expectedName);
  }
}

import { filterPlacesByCity, SUPPORTED_CITIES } from './cities';

// Remove the old CHAIN_CONFIGS and replace with this:
export const CHAIN_CONFIGS = [
  {
    name: '99 Ranch Market',
    searchQuery: '99 Ranch Market',
    regions: SUPPORTED_CITIES.map(city => ({
      name: city.name,
      lat: city.search.center.lat,
      lng: city.search.center.lng,
      radius: city.search.radius
    }))
  }
] as const;
