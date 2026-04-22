'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Search, Phone, Navigation, Clock, Loader2, LocateFixed, X, RefreshCw, MapPinOff } from 'lucide-react';

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
  const myLocationMarkerRef = useRef<any>(null);
  const skipDragEnd = useRef(false);
  const myLatLng = useRef<{ lat: number; lng: number } | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [showResearch, setShowResearch] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [retryingLocation, setRetryingLocation] = useState(false);
  // 'unknown' = 미확인 (Permissions API 미지원 or 아직 쿼리 안 함)
  // 'prompt'  = 권한 미결정 → getCurrentPosition 시 네이티브 팝업 뜸
  // 'denied'  = 거부된 상태 → 팝업 강제 불가, OS/앱 설정으로만 복구 가능
  // 'granted' = 이미 허용
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'denied' | 'granted'>('unknown');
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  // 로딩 피드백 단계: 0 = 기본, 1 = 2초 이후 (SDK 설명), 2 = 5초 이후 (사유 + 힌트).
  // Safari / 저사양 모바일에서 카카오맵 SDK + 위치 권한이 5~15초까지
  // 걸리는 케이스가 있어, 유저에게 "멈춘 게 아니라 진행 중" 임을 점진적으로 알림.
  const [loadingPhase, setLoadingPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (mapReady) return;
    const t1 = setTimeout(() => setLoadingPhase(1), 2000);
    const t2 = setTimeout(() => setLoadingPhase(2), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady]);

  // Permissions API 로 현재 위치 권한 상태 조회.
  // Chromium / Firefox 지원. Safari 는 미지원이므로 'unknown' 상태 유지
  // (기존 흐름: getCurrentPosition 호출 → 시스템이 알아서 팝업/거부 처리).
  // 상태가 변경되면(allow 를 눌러주면) listener 가 받아서 locationPermission
  // 을 갱신 → UI 도 실시간으로 반응.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    const update = () => { if (status) setLocationPermission(status.state as any); };
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(s => {
      status = s;
      update();
      s.addEventListener('change', update);
    }).catch(() => {});
    return () => { status?.removeEventListener('change', update); };
  }, []);

  // Resize handler — fix map when devtools or keyboard opens
  useEffect(() => {
    const handleResize = () => {
      if (mapInstance.current) {
        setTimeout(() => mapInstance.current?.relayout(), 100);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Load Kakao Maps SDK
  useEffect(() => {
    if (!KAKAO_KEY) {
      setError('카카오맵 API 키가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    // 10초 타임아웃 — 느린 네트워크에서 무한 로딩 방지
    const loadTimeout = setTimeout(() => {
      if (!mapInstance.current) {
        Sentry.captureMessage('Kakao map SDK load timeout', {
          level: 'warning',
          tags: { feature: 'map', action: 'sdk-timeout' },
        });
        setError('지도 로딩이 너무 오래 걸립니다. 네트워크를 확인해 주세요.');
        setLoading(false);
      }
    }, 10000);

    const safeInit = () => {
      try {
        if (!window.kakao?.maps?.Map) {
          throw new Error('Kakao Maps SDK not available');
        }
        initMap();
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'map', action: 'sdk-init' },
        });
        setError('지도를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        setLoading(false);
      }
    };

    if (window.kakao?.maps?.Map) {
      clearTimeout(loadTimeout);
      safeInit();
      return;
    }

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      existing.addEventListener('load', () => {
        clearTimeout(loadTimeout);
        window.kakao?.maps?.load(safeInit);
      });
      return () => clearTimeout(loadTimeout);
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      clearTimeout(loadTimeout);
      window.kakao?.maps?.load(safeInit);
    };
    script.onerror = () => {
      clearTimeout(loadTimeout);
      Sentry.captureMessage('Kakao map SDK script load failed', {
        level: 'error',
        tags: { feature: 'map', action: 'sdk-load-failed' },
      });
      setError('지도 SDK 로드에 실패했습니다. 네트워크를 확인해 주세요.');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => clearTimeout(loadTimeout);
  }, []);

  const showMyLocationMarker = useCallback((map: any, lat: number, lng: number) => {
    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setMap(null);
    }
    const position = new window.kakao.maps.LatLng(lat, lng);
    const content = `<div style="
      width: 16px; height: 16px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.3), 0 2px 4px rgba(0,0,0,0.2);
    "></div>`;
    const overlay = new window.kakao.maps.CustomOverlay({
      content,
      position,
      map,
      zIndex: 100,
    });
    myLocationMarkerRef.current = overlay;
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    const createMap = (lat: number, lng: number, isMyLocation: boolean) => {
      try {
        const container = mapContainerRef.current;
        if (!container) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 5,
        });
        mapInstance.current = map;
        setMapReady(true);

        if (isMyLocation) {
          myLatLng.current = { lat, lng };
          showMyLocationMarker(map, lat, lng);
        }

        window.kakao.maps.event.addListener(map, 'dragend', () => {
          if (skipDragEnd.current) {
            skipDragEnd.current = false;
            return;
          }
          setShowResearch(true);
        });

        searchNearby(lat, lng);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'map', action: 'init' },
        });
        console.error('Map init error:', err);
        setError('지도 초기화에 실패했습니다.');
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => createMap(pos.coords.latitude, pos.coords.longitude, true),
        () => {
          setLocationFailed(true);
          createMap(DEFAULT_LAT, DEFAULT_LNG, false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setLocationFailed(true);
      createMap(DEFAULT_LAT, DEFAULT_LNG, false);
    }
  }, []);

  // 주변 동물병원 검색 (기본)
  const searchNearby = useCallback((lat: number, lng: number) => {
    if (!window.kakao?.maps?.services) return;
    setLoading(true);
    setShowResearch(false);

    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '동물병원',
      (data: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setPlaces(parseResults(data));
        } else {
          setPlaces([]);
        }
        setLoading(false);
      },
      {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 20000,
        size: 15,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
      }
    );
  }, []);

  // 키워드 검색 (검색바 입력)
  const searchByKeyword = useCallback((lat: number, lng: number, keyword: string) => {
    if (!window.kakao?.maps?.services) return;
    setLoading(true);
    setShowResearch(false);

    const ps = new window.kakao.maps.services.Places();
    const searchText = /동물병원|동물|병원|pet|vet/i.test(keyword)
      ? keyword
      : `${keyword} 동물병원`;

    ps.keywordSearch(
      searchText,
      (data: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setPlaces(parseResults(data));
        } else {
          setPlaces([]);
        }
        setLoading(false);
      },
      {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 20000,
        size: 15,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
      }
    );
  }, []);

  const parseResults = (data: any[]): Place[] =>
    data.map((item: any) => ({
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

  // "이 지역 검색" — 항상 동물병원 검색 (검색바 키워드 무시)
  const handleResearchArea = () => {
    if (!mapInstance.current) return;
    const center = mapInstance.current.getCenter();
    searchNearby(center.getLat(), center.getLng());
  };

  // 위치 권한 재시도.
  //
  // Permissions API 로 분기:
  //   'denied' → 브라우저/OS 가 팝업 강제 띄우는 걸 막아놨음. getCurrentPosition
  //              를 불러봤자 즉시 error 만 뜨고 사용자에게 복구 방법 안내가
  //              안 됨. 대신 가이드 모달을 띄워서 설정 경로를 알려준다.
  //   'prompt' / 'unknown' / 'granted' → getCurrentPosition 호출. prompt 면
  //              네이티브 팝업이 뜨고, granted 면 즉시 좌표 반환, unknown
  //              (Safari 등 미지원) 도 그냥 호출해서 시스템이 알아서 처리.
  //
  // 일부 브라우저/PWA 는 권한 거부 상태에서 getCurrentPosition 콜백이 영원히
  // 안 돌아오고 timeout 옵션도 무시한다. safety 타이머로 12초 후 강제 리셋.
  // enableHighAccuracy: false + maximumAge: 0 → GPS 대신 네트워크 측위 우선,
  // 항상 새 측정 (캐시 무시). 재시도 시 속도가 더 중요하므로 정확도는 양보.
  const retryLocation = useCallback(() => {
    if (!navigator.geolocation || !mapInstance.current || retryingLocation) return;
    // 거부 상태면 브라우저가 팝업을 절대 안 띄우므로 사용자가 설정을 열어야 함.
    if (locationPermission === 'denied') {
      setShowPermissionGuide(true);
      return;
    }
    setRetryingLocation(true);
    let done = false;
    const finish = () => { done = true; setRetryingLocation(false); };
    const safety = setTimeout(() => {
      if (!done) finish();
    }, 12000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        clearTimeout(safety);
        const { latitude: lat, longitude: lng } = pos.coords;
        myLatLng.current = { lat, lng };
        const latLng = new window.kakao.maps.LatLng(lat, lng);
        mapInstance.current.setCenter(latLng);
        showMyLocationMarker(mapInstance.current, lat, lng);
        searchNearby(lat, lng);
        setLocationFailed(false);
        finish();
      },
      () => {
        if (done) return;
        clearTimeout(safety);
        finish();
        // getCurrentPosition 이 실패하는 대부분은 권한 문제.
        // Permissions API 가 'prompt' 였더라도 사용자가 시스템 팝업을
        // 거부했을 수 있으므로 다음 클릭부턴 가이드를 띄우게 한다.
        setShowPermissionGuide(true);
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 0 }
    );
  }, [retryingLocation, searchNearby, showMyLocationMarker, locationPermission]);

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

    skipDragEnd.current = true;
    mapInstance.current.setBounds(bounds);
  }, [filteredPlaces]);

  // Search bar submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapInstance.current) return;
    const center = mapInstance.current.getCenter();
    if (searchQuery.trim()) {
      searchByKeyword(center.getLat(), center.getLng(), searchQuery.trim());
    } else {
      searchNearby(center.getLat(), center.getLng());
    }
  };

  // Recenter
  const handleRecenter = () => {
    if (!navigator.geolocation || !mapInstance.current) return;
    setLocationFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const position = new window.kakao.maps.LatLng(latitude, longitude);
        mapInstance.current.setCenter(position);
        mapInstance.current.setLevel(5);
        myLatLng.current = { lat: latitude, lng: longitude };
        showMyLocationMarker(mapInstance.current, latitude, longitude);
        searchNearby(latitude, longitude);
      },
      () => {
        setLocationFailed(true);
      },
      { timeout: 10000, enableHighAccuracy: true }
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
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <MapPinOff size={28} className="text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">지도를 불러오지 못했어요</h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={14} />
              다시 시도
            </button>
          </div>
        </div>
      )}

      {!error && !mapReady && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-20 px-6">
          <div className="flex flex-col items-center gap-2 max-w-xs text-center">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-gray-600 font-medium">지도 로딩 중...</p>
            {loadingPhase >= 1 && (
              <p className="text-xs text-gray-400">카카오맵 SDK를 준비하고 있어요</p>
            )}
            {loadingPhase >= 2 && (
              <div className="mt-4 space-y-1.5 text-[11px] text-gray-500 leading-relaxed">
                <p className="font-medium text-gray-700">평소보다 시간이 걸리네요</p>
                <p>📶 네트워크 상태에 따라 최대 15초 정도 걸릴 수 있어요</p>
                <p>📍 위치 권한을 허용하면 더 빠르게 불러올 수 있어요</p>
              </div>
            )}
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
              placeholder="병원명 또는 지역 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
                  ? 'bg-blue-600 text-[#fff] border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {f.label} {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Location failed notice */}
      {locationFailed && mapReady && (
        <div className="absolute top-28 left-3 right-3 z-10">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-orange-500 text-xs">📍</span>
            <p className="text-xs text-orange-600 flex-1">
              {locationPermission === 'denied'
                ? '위치 권한이 차단되어 있어요. 설정에서 허용해주세요.'
                : '현재 위치를 가져올 수 없어 기본 위치로 표시됩니다.'}
            </p>
            <button
              onClick={locationPermission === 'denied' ? () => setShowPermissionGuide(true) : retryLocation}
              disabled={retryingLocation}
              className="flex items-center gap-1 text-[11px] font-medium text-orange-600 bg-orange-100 hover:bg-orange-200 disabled:opacity-60 px-2 py-0.5 rounded-full flex-shrink-0"
            >
              {retryingLocation ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              {locationPermission === 'denied' ? '허용 방법' : '다시 시도'}
            </button>
            <button
              onClick={() => setLocationFailed(false)}
              className="text-orange-400 hover:text-orange-600 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* "이 지역 검색" 버튼 */}
      {showResearch && !locationFailed && (
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
                className="flex-1 py-2.5 bg-blue-600 text-[#fff] rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Phone size={16} /> 전화하기
              </a>
            )}
            <a
              href={`https://map.kakao.com/link/to/${selectedPlace.place_name},${selectedPlace.y},${selectedPlace.x}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-yellow-400 text-gray-900 rounded-lg text-sm font-medium hover:bg-yellow-500 flex items-center justify-center gap-2"
            >
              <Navigation size={16} /> 길찾기
            </a>
            <a
              href={selectedPlace.place_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <Search size={16} /> 상세
            </a>
          </div>
        </div>
      )}

      {/* 위치 권한 가이드 모달 — 'denied' 상태에서 "다시 시도" 로는 복구 불가,
          사용자가 OS / 앱 설정에서 직접 풀어야 함. 단계별 경로 안내. */}
      {showPermissionGuide && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPinOff size={20} className="text-orange-500" />
                <h3 className="text-base font-bold text-gray-800">위치 권한 허용하기</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                주변 동물병원을 찾으려면 위치 권한이 필요해요.
                기기별 설정 경로를 안내해드릴게요.
              </p>
              <div className="space-y-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-700 mb-1.5">📱 Android — 앱 설치한 경우</p>
                  <p className="text-gray-500 leading-relaxed">
                    설정 → 앱 → <span className="font-medium text-gray-700">PawDex</span> → 권한 → 위치 → <span className="font-medium text-gray-700">허용</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-700 mb-1.5">🌐 Android — 크롬 브라우저</p>
                  <p className="text-gray-500 leading-relaxed">
                    주소창 왼쪽 🔒 아이콘 → 권한 → 위치 → <span className="font-medium text-gray-700">허용</span>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-700 mb-1.5">🍎 iPhone — Safari</p>
                  <p className="text-gray-500 leading-relaxed">
                    설정 → Safari → 위치 → <span className="font-medium text-gray-700">허용</span>
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                허용 후 이 창을 닫고 <b>다시 시도</b> 를 눌러주세요.
              </p>
            </div>
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => setShowPermissionGuide(false)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
