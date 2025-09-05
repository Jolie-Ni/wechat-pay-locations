export interface City {
  id: string;
  name: string;
  displayName: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  // Add search configuration
  search: {
    center: { lat: number; lng: number };
    radius: number; // in meters
  };
}

// Helper function to check if coordinates are within city bounds
export function isWithinCityBounds(lat: number, lng: number, city: City): boolean {
  return (
    lat >= city.bounds.south &&
    lat <= city.bounds.north &&
    lng >= city.bounds.west &&
    lng <= city.bounds.east
  );
}

// Helper function to filter places by city bounds
export function filterPlacesByCity<T extends { geometry: { location: { lat: number; lng: number } } }>(
  places: T[],
  city: City
): T[] {
  return places.filter(place => 
    isWithinCityBounds(
      place.geometry.location.lat,
      place.geometry.location.lng,
      city
    )
  );
}

export const SUPPORTED_CITIES: City[] = [
  {
    id: 'sf-bay-area',
    name: 'San Francisco Bay Area',
    displayName: 'SF Bay Area',
    bounds: {
      north: 38.0,
      south: 37.1,
      east: -121.7,
      west: -122.6
    },
    center: {
      lat: 37.55,
      lng: -122.15
    },
    zoom: 10,
    search: {
      center: { lat: 37.55, lng: -122.15 }, // Use same center as map
      radius: 65000 // 65km radius - covers Bay Area but excludes Sacramento
    }
  },
  {
    id: 'los-angeles',
    name: 'Los Angeles',
    displayName: 'Los Angeles',
    bounds: {
      north: 34.35,
      south: 33.7,
      east: -117.8,
      west: -118.7
    },
    center: {
      lat: 34.05,
      lng: -118.25
    },
    zoom: 10,
    search: {
      center: { lat: 34.05, lng: -118.25 },
      radius: 70000 // 70km radius for LA metro area
    }
  },
  {
    id: 'seattle',
    name: 'Seattle',
    displayName: 'Seattle',
    bounds: {
      north: 47.8,
      south: 47.4,
      east: -122.0,
      west: -122.6
    },
    center: {
      lat: 47.6,
      lng: -122.3
    },
    zoom: 11,
    search: {
      center: { lat: 47.6, lng: -122.3 },
      radius: 80000 // 80km radius for Seattle metro area
    }
  },
  {
    id: 'new-york',
    name: 'New York City',
    displayName: 'NYC',
    bounds: {
      north: 40.9,
      south: 40.5,
      east: -73.7,
      west: -74.3
    },
    center: {
      lat: 40.7,
      lng: -74.0
    },
    zoom: 11,
    search: {
      center: { lat: 40.7, lng: -74.0 },
      radius: 90000 // 90km radius for NYC metro area
    }
  }
];

export function getCityById(cityId: string): City | undefined {
  return SUPPORTED_CITIES.find(city => city.id === cityId);
}

export function getCityByCoordinates(lat: number, lng: number): City | undefined {
  return SUPPORTED_CITIES.find(city => 
    lat >= city.bounds.south &&
    lat <= city.bounds.north &&
    lng >= city.bounds.west &&
    lng <= city.bounds.east
  );
}

export function getCityBounds(cityId: string) {
  const city = getCityById(cityId);
  if (!city) return null;
  
  return {
    minLng: city.bounds.west,
    minLat: city.bounds.south,
    maxLng: city.bounds.east,
    maxLat: city.bounds.north
  };
}

export interface GeolocationResult {
  success: boolean;
  city?: City;
  coordinates?: {
    lat: number;
    lng: number;
  };
  error?: string;
}

export async function detectUserCity(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: 'Geolocation is not supported by this browser'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const detectedCity = getCityByCoordinates(lat, lng);
        
        resolve({
          success: true,
          city: detectedCity,
          coordinates: { lat, lng }
        });
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        
        resolve({
          success: false,
          error: errorMessage
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
}
