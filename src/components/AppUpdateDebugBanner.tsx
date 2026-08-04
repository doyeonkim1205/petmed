'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { isNativeApp } from '@/lib/platform/env';
import { isSoftDismissActive } from '@/lib/appVersionCompare';

// ⚠️ TEMP — dismiss/persistence 진단 배너. 검증 끝나면 제거.
//   removeConsole 로 console 이 Preview 에서 지워져 화면에 직접 표시.
//   launch# = 실행할 때마다 localStorage 카운터 증가 → persistence 독립 검증
//     (1,1,1 = localStorage 안 유지 / 1,2,3 = 유지). 1초마다 갱신.
export function AppUpdateDebugBanner() {
  const { decision, latestBuild, platform, installedBuild } = useAppUpdate();
  const [launch, setLaunch] = useState<string>('?');
  const [, setTick] = useState(0);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem('debug-launch-count') || '0') + 1;
      localStorage.setItem('debug-launch-count', String(n));
      setLaunch(String(n));
    } catch {
      setLaunch('LSERR');
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000); // 실시간 갱신
    return () => clearInterval(id);
  }, []);

  if (typeof document === 'undefined' || !isNativeApp()) return null;

  let dismiss = 'dismiss=?';
  try {
    if (latestBuild) {
      const raw = localStorage.getItem(`app-update-dismissed:${platform}:${latestBuild}`);
      dismiss = `raw=${raw ?? 'NULL'} act=${isSoftDismissActive(raw, Date.now())}`;
    }
  } catch {
    dismiss = 'LS_READ_ERR';
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0,
        zIndex: 2147483647, background: 'rgba(0,0,0,0.9)', color: '#4ade80',
        fontSize: '10px', lineHeight: '1.4', padding: '6px 8px',
        fontFamily: 'monospace', wordBreak: 'break-all',
      }}
    >
      launch#{launch} · dec={decision} · inst={installedBuild ?? 'null'} · latest={latestBuild ?? 'null'}
      <br />
      {dismiss} · host={window.location.host}
    </div>,
    document.body,
  );
}
