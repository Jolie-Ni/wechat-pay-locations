import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Merchant } from '../types/merchant';
import { SUPPORTED_CITIES, getCityById, getCityBounds, type City } from '../lib/cities';

// Google Maps component (client-side only)
function MapComponent({ merchants, onBoundsChanged, selectedCity }: {
  merchants: Merchant[];
  onBoundsChanged: (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => void;
  selectedCity?: City;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (typeof google !== 'undefined' && google.maps) {
      setIsGoogleLoaded(true);
      return;
    }

    // Wait for Google Maps to be loaded by the script in _document.tsx
    const checkGoogleMaps = () => {
      if (typeof google !== 'undefined' && google.maps) {
        setIsGoogleLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    // Initialize Google Map only after Google is loaded
    if (mapRef.current && !googleMapRef.current && isGoogleLoaded) {
      const defaultCenter = selectedCity?.center || { lat: 37.7749, lng: -122.4194 };
      const defaultZoom = selectedCity?.zoom || 10;
      
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Add bounds change listener
      googleMapRef.current.addListener('idle', () => {
        if (googleMapRef.current) {
          const bounds = googleMapRef.current.getBounds();
          if (bounds) {
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            onBoundsChanged({
              minLng: sw.lng(),
              minLat: sw.lat(),
              maxLng: ne.lng(),
              maxLat: ne.lat()
            });
          }
        }
              });
    }
  }, [onBoundsChanged, isGoogleLoaded]);

  // Update map center and zoom when city changes
  useEffect(() => {
    if (googleMapRef.current && selectedCity) {
      googleMapRef.current.setCenter(selectedCity.center);
      googleMapRef.current.setZoom(selectedCity.zoom);
    }
  }, [selectedCity]);

  useEffect(() => {
    // Update markers when merchants change
    if (googleMapRef.current && isGoogleLoaded) {
      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Add new markers
      merchants.forEach(merchant => {
        const marker = new google.maps.Marker({
          position: { lat: merchant.lat, lng: merchant.lng },
          map: googleMapRef.current,
          title: merchant.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#00C853"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 32)
          }
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div class="p-3 max-w-sm">
              <h3 class="font-semibold text-lg">${merchant.name}</h3>
              ${merchant.address ? `<p class="text-sm text-gray-600 mt-1">${merchant.address}</p>` : ''}
              <div class="mt-2">
                <span class="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  WeChat Pay
                </span>
                ${merchant.chain_name ? `
                  <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded ml-1">
                    ${merchant.chain_name}
                  </span>
                ` : ''}
              </div>
              <p class="text-xs text-gray-500 mt-2">
                Source: ${merchant.source === 'google_places_api' ? 'Google Places' : 'Manual'}
              </p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
      });
    }
  }, [merchants, isGoogleLoaded]);

  if (!isGoogleLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full" />;
}

// Create a client-side only version of MapComponent
const DynamicMapComponent = dynamic(() => Promise.resolve(MapComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

export default function HomePage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [selectedCityId, setSelectedCityId] = useState<string>('sf-bay-area');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCity = getCityById(selectedCityId);

  const fetchMerchants = useCallback(async (bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number }) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use city bounds if available, otherwise use provided bounds
      const searchBounds = bounds || (selectedCityId ? getCityBounds(selectedCityId) : null);
      
      if (!searchBounds) {
        setError('No search area defined');
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams({
        bbox: `${searchBounds.minLng},${searchBounds.minLat},${searchBounds.maxLng},${searchBounds.maxLat}`
      });
      
      if (selectedChain !== 'all') {
        params.append('chain', selectedChain);
      }
      
      const response = await fetch(`/api/places?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch merchants');
      }
      
      setMerchants(data.places);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch merchants when city or chain changes
  useEffect(() => {
    if (selectedCityId) {
      const cityBounds = getCityBounds(selectedCityId);
      if (cityBounds) {
        fetchMerchants(cityBounds);
      }
    }
  }, [selectedCityId, selectedChain, fetchMerchants]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">WeChat Pay Locations</h1>
          
          <div className="flex items-center space-x-4">
            {/* City Selector */}
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {SUPPORTED_CITIES.map(city => (
                <option key={city.id} value={city.id}>
                  {city.displayName}
                </option>
              ))}
            </select>
            
            {/* Chain Filter */}
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Stores</option>
              <option value="99 Ranch Market">99 Ranch Market</option>
              <option value="H Mart">H Mart</option>
            </select>
            
            {/* Status indicators */}
            <div className="flex items-center space-x-2 text-sm">
              {loading && <span className="text-blue-600">Loading...</span>}
              {error && <span className="text-red-600">Error: {error}</span>}
              <span className="text-gray-600">
                {merchants.length} location{merchants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <main className="flex-1 relative">
        <DynamicMapComponent 
          merchants={merchants} 
          onBoundsChanged={(bounds) => fetchMerchants(bounds)}
          selectedCity={selectedCity}
        />
      </main>
      
      {/* Info Panel */}
      <div className="bg-white border-t p-4">
        <p className="text-sm text-gray-600">
          Showing businesses that accept WeChat Pay. Green markers indicate confirmed locations.
          Data includes major chains like 99 Ranch Market and H Mart, plus manually added locations.
        </p>
      </div>
    </div>
  );
}
