'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { isNativeApp, getPlatform, getAppInfo } from '@/lib/platform/env';
import { decideUpdate } from '@/lib/appVersionCompare';

// 앱 스토어 업데이트 판정 상태 보관(v1: 선택 업데이트만 사용, 하드 게이트는 나중).
//   네이티브에서만 동작(웹=none). 원격 설정을 no-store 로 "현재 실행에서 신선하게" 조회 후 판정.
//   조회/파싱 실패는 전부 fail-open(none) — 잘못된 설정·네트워크로 앱을 막지 않는다.

export interface AppUpdateState {
  decision: 'force' | 'soft' | 'none';
  latestBuild: string | null;
  storeUrl: string | null;
  reminderDays: number;
  platform: 'android' | 'ios' | 'web';
  installedBuild: string | null; // 설치된 네이티브 build (진단 표시 겸)
}

const DEFAULT: AppUpdateState = { decision: 'none', latestBuild: null, storeUrl: null, reminderDays: 7, platform: 'web', installedBuild: null };

const AppUpdateContext = createContext<AppUpdateState>(DEFAULT);
export const useAppUpdate = () => useContext(AppUpdateContext);

export function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppUpdateState>(DEFAULT);

  useEffect(() => {
    if (!isNativeApp()) return; // 웹은 스토어 업데이트 개념 없음
    const platform = getPlatform();
    if (platform !== 'android' && platform !== 'ios') return;

    let alive = true;
    (async () => {
      try {
        const info = await getAppInfo();
        if (!info || !alive) return;
        // no-store — 필수 업데이트는 반드시 "현재 실행의 신선 응답"으로만 발동해야 하므로 캐시 금지.
        const res = await fetch(`/api/app-config?platform=${platform}`, { cache: 'no-store' });
        if (!res.ok || !alive) return;
        const cfg = await res.json();
        if (!cfg?.enabled) return; // fail-open: 비활성/오설정 → none 유지
        const decision = decideUpdate(info.build, {
          enabled: true,
          latestBuild: cfg.latestBuild ?? null,
          minSupportedBuild: cfg.minSupportedBuild ?? null,
        });
        if (!alive) return;
        setState({
          decision,
          latestBuild: cfg.latestBuild ?? null,
          storeUrl: cfg.storeUrl ?? null,
          reminderDays: typeof cfg.reminderDays === 'number' && cfg.reminderDays >= 1 ? cfg.reminderDays : 7,
          platform,
          installedBuild: info.build,
        });
      } catch {
        // 네트워크/파싱 실패 → none 유지(fail-open).
      }
    })();
    return () => { alive = false; };
  }, []);

  return <AppUpdateContext.Provider value={state}>{children}</AppUpdateContext.Provider>;
}
