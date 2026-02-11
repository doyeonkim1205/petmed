'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Phone, Navigation, Clock, Star, Loader2, LocateFixed } from 'lucide-react';

declare global {
  interface Window {
    kakao: any;
  }
}

interface Place {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  x: string;
  y: string;
  category_name: string;
  place_url: string;
  is24h: boolean;
}

type Filter = 'all' | '24h' | 'normal';

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);

  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // Load Kakao Maps SDK
  useEffect(() => {
    if (window.kakao?.maps) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => setSdkLoaded(true));
    };
    document.head.appendChild(script);
  }, []);

  // Get user location + init map
  useEffect(() => {
    if (!sdkLoaded || !mapRef.current) return;

    const defaultPos = { lat: 37.5665, lng: 126.978 }; // Seoul City Hall

    const initMap = (lat: number, lng: number) => {
      const position = new window.kakao.maps.LatLng(lat, lng);
      const map = new window.kakao.maps.Map(mapRef.current, {
        center: position,
        level: 4,
      });

      // Add zoom control
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      mapInstance.current = map;
      setUserPos({ lat, lng });
      searchNearbyHospitals(lat, lng);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
        () => initMap(defaultPos.lat, defaultPos.lng),
        { timeout: 5000 }
      );
    } else {
      initMap(defaultPos.lat, defaultPos.lng);
    }
  }, [sdkLoaded]);

  // Search nearby hospitals
  const searchNearbyHospitals = useCallback((lat: number, lng: number, keyword?: string) => {
    if (!window.kakao?.maps?.services) return;
    setLoading(true);

    const ps = new window.kakao.maps.services.Places();
    const position = new window.kakao.maps.LatLng(lat, lng);

    const searchText = keyword?.trim() || '동물병원';

    ps.keywordSearch(
      searchText,
      (data: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const parsed: Place[] = data.map((item: any) => ({
            id: item.id,
            place_name: item.place_name,
            address_name: item.address_name,
            road_address_name: item.road_address_name || item.address_name,
            phone: item.phone || '',
            x: item.x,
            y: item.y,
            category_name: item.category_name || '',
            place_url: item.place_url || '',
            is24h: /24시|24h|야간|응급/i.test(item.place_name),
          }));
          setPlaces(parsed);
        } else {
          setPlaces([]);
        }
        setLoading(false);
      },
      {
        location: position,
        radius: 5000,
        size: 15,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
      }
    );
  }, []);

  // Filter places
  useEffect(() => {
    let result = places;
    if (activeFilter === '24h') {
      result = places.filter((p) => p.is24h);
    } else if (activeFilter === 'normal') {
      result = places.filter((p) => !p.is24h);
    }
    setFilteredPlaces(result);
  }, [places, activeFilter]);

  // Update markers when filtered places change
  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return;

    // Clear existing markers and overlays
    markersRef.current.forEach((m) => m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    const bounds = new window.kakao.maps.LatLngBounds();

    filteredPlaces.forEach((place) => {
      const position = new window.kakao.maps.LatLng(
        parseFloat(place.y),
        parseFloat(place.x)
      );

      // Custom marker image
      const markerColor = place.is24h ? '#EF4444' : '#3B82F6';
      const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${markerColor}"/><circle cx="16" cy="14" r="7" fill="white"/><text x="16" y="17" text-anchor="middle" font-size="10" font-weight="bold" fill="${markerColor}">${place.is24h ? '24' : 'H'}</text></svg>`;
      const blob = new Blob([markerSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const markerImage = new window.kakao.maps.MarkerImage(
        url,
        new window.kakao.maps.Size(32, 40),
        { offset: new window.kakao.maps.Point(16, 40) }
      );

      const marker = new window.kakao.maps.Marker({
        position,
        map: mapInstance.current,
        image: markerImage,
        title: place.place_name,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedPlace(place);
        mapInstance.current.panTo(position);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (filteredPlaces.length > 0) {
      mapInstance.current.setBounds(bounds, 80);
    }
  }, [filteredPlaces]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPos) return;
    const query = searchQuery.trim()
      ? `${searchQuery.trim()} 동물병원`
      : '동물병원';
    searchNearbyHospitals(userPos.lat, userPos.lng, query);
  };

  // Recenter to user location
  const handleRecenter = () => {
    if (!navigator.geolocation || !mapInstance.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const position = new window.kakao.maps.LatLng(latitude, longitude);
      mapInstance.current.setCenter(position);
      setUserPos({ lat: latitude, lng: longitude });
      searchNearbyHospitals(latitude, longitude);
    });
  };

  const filters = [
    { id: 'all' as Filter, label: '전체' },
    { id: '24h' as Filter, label: '24시 병원' },
    { id: 'normal' as Filter, label: '일반 병원' },
  ];

  return (
    <div className="relative h-full min-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Map Container */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {(!sdkLoaded || loading) && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">
              {!sdkLoaded ? '지도 로딩 중...' : '병원 검색 중...'}
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 bg-white rounded-lg shadow-md flex items-center px-3 py-2.5">
            <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="동물병원 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleRecenter}
            className="bg-white rounded-lg shadow-md p-2.5 text-gray-600 hover:text-blue-600"
          >
            <LocateFixed size={20} />
          </button>
        </form>
      </div>

      {/* Filter Chips */}
      <div className="absolute top-[4.5rem] left-4 right-4 z-10 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm transition-colors border ${
              activeFilter === f.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {f.label}
            {f.id !== 'all' && (
              <span className="ml-1 opacity-70">
                {f.id === '24h'
                  ? places.filter((p) => p.is24h).length
                  : places.filter((p) => !p.is24h).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && sdkLoaded && (
        <div className="absolute top-28 left-4 z-10">
          <span className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-gray-600 shadow-sm">
            {filteredPlaces.length}개 병원
          </span>
        </div>
      )}

      {/* Bottom Sheet for Selected Place */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-xl p-4 z-20 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <button
            onClick={() => setSelectedPlace(null)}
            className="absolute top-3 right-3 text-gray-400 p-1 bg-gray-50 rounded-full hover:bg-gray-100"
          >
            ✕
          </button>

          <div className="mb-3">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2 pr-8">
              {selectedPlace.place_name}
              {selectedPlace.is24h && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                  <Clock size={10} /> 24시
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedPlace.road_address_name}
            </p>
            {selectedPlace.phone && (
              <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                <Phone size={14} />
                {selectedPlace.phone}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {selectedPlace.phone && (
              <a
                href={`tel:${selectedPlace.phone}`}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Phone size={16} /> 전화하기
              </a>
            )}
            <a
              href={selectedPlace.place_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <Navigation size={16} /> 상세보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
