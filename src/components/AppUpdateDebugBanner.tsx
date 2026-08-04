'use client';

import { createPortal } from 'react-dom';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { isSoftDismissActive } from '@/lib/appVersionCompare';

// ⚠️ TEMP — dismiss persistence 진단용 온스크린 배너. 검증 끝나면 제거.
//   removeConsole 로 console 이 Preview 에서 지워져서, 화면에 직접 표시해 chrome://inspect 없이 확인.
//   네이티브(latestBuild 세팅됨)에서만 뜸. 웹/비네이티브는 null.
export function AppUpdateDebugBanner() {
  const { decision, latestBuild, platform, reminderDays } = useAppUpdate();
  if (typeof document === 'undefined' || !latestBuild) return null;

  let line: string;
  try {
    const key = `app-update-dismissed:${platform}:${latestBuild}`;
    const raw = localStorage.getItem(key);
    line = `dec=${decision} key=${key} raw=${raw ?? '∅'} active=${isSoftDismissActive(raw, Date.now())} host=${window.location.host} rd=${reminderDays}`;
  } catch (e) {
    line = 'LS_ERROR ' + String(e);
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0,
        zIndex: 2147483647, background: 'rgba(0,0,0,0.9)', color: '#4ade80',
        fontSize: '10px', lineHeight: '1.35', padding: '6px 8px',
        fontFamily: 'monospace', wordBreak: 'break-all',
      }}
    >
      {line}
    </div>,
    document.body,
  );
}
