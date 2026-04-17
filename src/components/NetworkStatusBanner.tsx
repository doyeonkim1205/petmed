'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * 네트워크 상태 배너.
 *
 * navigator.onLine 이 false 가 되면 상단에 빨간 바 표시.
 * 네트워크 복귀 시 "연결됨!" 초록 바 잠깐 보여주고 자동 사라짐.
 */
export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    // 초기 상태
    setOffline(!navigator.onLine);

    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setRecovered(true);
      setTimeout(() => setRecovered(false), 2500);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // 모바일/TWA 에서 online/offline 이벤트가 안 발생하는 경우 대비
    // 3초마다 navigator.onLine 폴링
    const poll = setInterval(() => {
      const nowOffline = !navigator.onLine;
      if (nowOffline && !offline) goOffline();
      else if (!nowOffline && offline) goOnline();
    }, 3000);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      clearInterval(poll);
    };
  }, [offline]);

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
