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
}

export const SUPPORTED_CITIES: City[] = [
  {
    id: 'sf-bay-area',
    name: 'San Francisco Bay Area',
    displayName: 'SF Bay Area',
    bounds: {
      north: 38.0,
      south: 37.2,
      east: -121.5,
      west: -122.8
    },
    center: {
      lat: 37.6,
      lng: -122.15
    },
    zoom: 10
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
    zoom: 10
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
    zoom: 11
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
    zoom: 11
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
