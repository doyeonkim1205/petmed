'use client';

import { useState, useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * 네트워크 상태 배너.
 *
 * navigator.onLine 은 일부 기기에서 비행기모드에도 true 반환하므로,
 * 실제 fetch 를 통해 연결 상태를 확인한다.
 *
 * 5초 간격으로 favicon 에 HEAD 요청 → 실패하면 오프라인 판정.
 * online/offline 이벤트도 병행해서 빠른 감지 + 확실한 감지 둘 다.
 */
export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const markOffline = () => {
      if (!wasOfflineRef.current) {
        wasOfflineRef.current = true;
        setOffline(true);
      }
    };

    const markOnline = () => {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setOffline(false);
        setRecovered(true);
        setTimeout(() => setRecovered(false), 2500);
      }
    };

    // 이벤트 기반 (빠른 감지)
    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);

    // fetch 기반 폴링 (확실한 감지)
    const checkConnection = async () => {
      try {
        const res = await fetch('/icons/icon-192x192.png', {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (res.ok) markOnline();
        else markOffline();
      } catch {
        markOffline();
      }
    };

    const poll = setInterval(checkConnection, 5000);

    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
      clearInterval(poll);
    };
  }, []);

  if (!offline && !recovered) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-white transition-colors ${
        offline ? 'bg-red-500' : 'bg-green-500'
      }`}
    >
      {offline ? (
        <>
          <WifiOff size={14} />
          오프라인 상태입니다. 일부 기능이 제한됩니다.
        </>
      ) : (
        '네트워크가 복구되었습니다!'
      )}
    </div>
  );
}
