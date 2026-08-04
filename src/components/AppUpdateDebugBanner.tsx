'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppUpdate } from '@/contexts/AppUpdateContext';
import { isNativeApp } from '@/lib/platform/env';
import { isSoftDismissActive } from '@/lib/appVersionCompare';

// ⚠️ TEMP — persistence/dismiss 진단 배너. 검증 끝나면 제거(prod 병합 전 필수).
//   removeConsole 로 console 이 Preview 에서 지워져 화면에 직접 표시.
//   probe = dismiss 와 무관한 일반 저장 probe(origin+저장시각). 재실행 후:
//     SURVIVED + origin 동일 → 저장소 유지됨(그럼 dismiss 문제는 별개로 좁혀짐)
//     NEW(=사라짐) → 저장소 전체가 초기화됨(로그인·dismiss 다 날아가는 근본 원인)
//     SURVIVED + origin 다름 → origin 분리 문제(저장소는 멀쩡, 키를 다른 origin에서 못 읽음)
export function AppUpdateDebugBanner() {
  const { decision, latestBuild, platform, installedBuild } = useAppUpdate();
  const [launch, setLaunch] = useState('?');
  const [probe, setProbe] = useState('?');
  const [, setTick] = useState(0);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem('debug-launch-count') || '0') + 1;
      localStorage.setItem('debug-launch-count', String(n));
      setLaunch(String(n));

      const raw = localStorage.getItem('__pawdex_persist_probe__');
      if (raw) {
        try {
          const p = JSON.parse(raw) as { origin: string; savedAt: number };
          const sameOrigin = p.origin === window.location.origin;
          setProbe(`SURVIVED sameOrigin=${sameOrigin} age=${Math.round((Date.now() - p.savedAt) / 1000)}s savedOn=${p.origin.replace(/^https?:\/\//, '')}`);
        } catch {
          setProbe('SURVIVED(corrupt)');
        }
      } else {
        localStorage.setItem('__pawdex_persist_probe__', JSON.stringify({ origin: window.location.origin, savedAt: Date.now() }));
        setProbe('NEW(방금 저장 — 재실행 후 SURVIVED 여야 정상)');
      }
    } catch {
      setLaunch('LSERR');
      setProbe('LSERR');
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
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
      <br />
      probe={probe}
    </div>,
    document.body,
  );
}
