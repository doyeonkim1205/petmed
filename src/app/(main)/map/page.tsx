'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Phone, Navigation, Clock, Loader2, LocateFixed, X, RefreshCw } from 'lucide-react';

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
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [showResearch, setShowResearch] = useState(false);

  // 1. Load Kakao Maps SDK
  useEffect(() => {
    if (!KAKAO_KEY) {
      setError('카카오맵 API 키가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    if (window.kakao?.maps?.Map) {
      initMap();
      return;
    }

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      existing.addEventListener('load', () => {
        window.kakao.maps.load(() => initMap());
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => initMap());
    };
    script.onerror = () => {
      setError('카카오맵 SDK 로드에 실패했습니다.');
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    const createMap = (lat: number, lng: number) => {
      try {
        const container = mapContainerRef.current;
        if (!container) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 5,
        });
        mapInstance.current = map;
        setMapReady(true);

        // 지도 이동 완료 시 "이 지역 검색" 버튼 표시
        window.kakao.maps.event.addListener(map, 'dragend', () => {
          setShowResearch(true);
        });

        searchHospitals(lat, lng);
      } catch (err) {
        console.error('Map init error:', err);
        setError('지도 초기화에 실패했습니다.');
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => createMap(pos.coords.latitude, pos.coords.longitude),
        () => createMap(DEFAULT_LAT, DEFAULT_LNG),
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      createMap(DEFAULT_LAT, DEFAULT_LNG);
    }
  }, []);

  // Search nearby hospitals
  const searchHospitals = useCallback((lat: number, lng: number, keyword?: string) => {
    if (!window.kakao?.maps?.services) return;
    setLoading(true);
    setShowResearch(false);

    const ps = new window.kakao.maps.services.Places();
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
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 5000,
        size: 15,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
      }
    );
  }, []);

  // "이 지역 검색" - 현재 지도 중심으로 재검색
  const handleResearchArea = () => {
    if (!mapInstance.current) return;
    const center = mapInstance.current.getCenter();
    const keyword = searchQuery.trim()
      ? `${searchQuery.trim()} 동물병원`
      : '동물병원';
    searchHospitals(center.getLat(), center.getLng(), keyword);
  };

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

  // Update markers
  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (filteredPlaces.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();

    filteredPlaces.forEach((place) => {
      const position = new window.kakao.maps.LatLng(
        parseFloat(place.y),
        parseFloat(place.x)
      );

      const marker = new window.kakao.maps.Marker({
        position,
        map: mapInstance.current,
      });

      const content = `<div style="
        padding: 2px 8px;
        background: ${place.is24h ? '#EF4444' : '#3B82F6'};
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        transform: translateY(-8px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">${place.is24h ? '24시' : 'H'}</div>`;

      const overlay = new window.kakao.maps.CustomOverlay({
        content,
        position,
        yAnchor: 2.5,
        map: mapInstance.current,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedPlace(place);
        mapInstance.current.panTo(position);
      });

      markersRef.current.push(marker);
      markersRef.current.push(overlay);
      bounds.extend(position);
    });

    mapInstance.current.setBounds(bounds);
  }, [filteredPlaces]);

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapInstance.current) return;
    const center = mapInstance.current.getCenter();
    const query = searchQuery.trim()
      ? `${searchQuery.trim()} 동물병원`
      : '동물병원';
    searchHospitals(center.getLat(), center.getLng(), query);
  };

  // Recenter
  const handleRecenter = () => {
    if (!navigator.geolocation || !mapInstance.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const position = new window.kakao.maps.LatLng(latitude, longitude);
        mapInstance.current.setCenter(position);
        mapInstance.current.setLevel(5);
        searchHospitals(latitude, longitude);
      },
      () => {},
      { timeout: 5000 }
    );
  };

  const filters = [
    { id: 'all' as Filter, label: '전체' },
    { id: '24h' as Filter, label: '24시 병원' },
    { id: 'normal' as Filter, label: '일반 병원' },
  ];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100dvh - 7.5rem)' }}
    >
      <div
        ref={mapContainerRef}
        id="kakao-map"
        className="w-full h-full"
      />

      {error && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-30 p-6">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-blue-600 underline"
            >
              새로고침
            </button>
          </div>
        </div>
      )}

      {!error && !mapReady && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">지도 로딩 중...</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 bg-white rounded-lg shadow-md flex items-center px-3 py-2.5">
            <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="동물병원 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            />
            <button type="submit" className="ml-1 text-blue-600 flex-shrink-0">
              <Search size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleRecenter}
            className="bg-white rounded-lg shadow-md p-2.5 text-gray-600 hover:text-blue-600 active:bg-gray-50"
          >
            <LocateFixed size={20} />
          </button>
        </form>
      </div>

      {/* Filter Chips */}
      <div className="absolute top-16 left-3 right-3 z-10 flex gap-2">
        {filters.map((f) => {
          const count =
            f.id === '24h'
              ? places.filter((p) => p.is24h).length
              : f.id === 'normal'
              ? places.filter((p) => !p.is24h).length
              : places.length;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm transition-colors border ${
                activeFilter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {f.label} {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* "이 지역 검색" 버튼 - 지도 이동 후 표시 */}
      {showResearch && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={handleResearchArea}
            className="flex items-center gap-1.5 bg-white text-blue-600 px-4 py-2 rounded-full shadow-lg text-sm font-medium border border-blue-100 hover:bg-blue-50 active:scale-95 transition-all"
          >
            <RefreshCw size={14} />
            이 지역 검색
          </button>
        </div>
      )}

      {/* Bottom Sheet */}
      {selectedPlace && (
        <div className="absolute bottom-3 left-3 right-3 bg-white rounded-xl shadow-xl p-4 z-20">
          <button
            onClick={() => setSelectedPlace(null)}
            className="absolute top-3 right-3 p-1.5 text-gray-400 bg-gray-100 rounded-full hover:bg-gray-200"
          >
            <X size={16} />
          </button>

          <div className="mb-3 pr-8">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
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
