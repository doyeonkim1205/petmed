'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isMarketRegion, inferMarketRegion } from '@/lib/region';

/**
 * 로그인 유저의 market_region 이 아직 없으면(신규 등) 기기 타임존으로 최초 추정해 프로필에 기록.
 * - 추정 성공(KR/US)일 때만 기록, source='timezone_inferred'.
 * - 추정 불가(null: 일본/유럽/캐나다 등)면 아무것도 안 함 → 나중에 설정에서 사용자가 확정.
 * - 이미 값이 있으면(legacy_default/user_selected/timezone_inferred) 건드리지 않음 — 자동 덮어쓰기 금지.
 *
 * (언어 seed 를 담당하는 LocaleSync 와 동일한 역할·위치. 지역은 계정 종속이라 쿠키 불필요:
 *  통화·지도 등 지역 민감 화면이 모두 인증 뒤 클라 렌더라 SSR projection 이 없음.)
 */
export function RegionSync() {
  const { user, profile } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (!user || !profile) return;
    const needRegion = !isMarketRegion(profile.market_region);
    const needQuotaTz = !profile.quota_timezone;
    if (!needRegion && !needQuotaTz) return; // 둘 다 이미 설정됨

    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}

    const updates: Record<string, string> = {};
    if (needRegion) {
      const inferred = inferMarketRegion(tz); // 확신 없으면 null → 지역은 보류
      if (inferred) {
        updates.market_region = inferred;
        updates.market_region_source = 'timezone_inferred';
      }
    }
    // quota_timezone 은 '지역 추정'과 달리 기기 tz 원본을 그대로 저장(확신 문제 없음).
    if (needQuotaTz && tz) updates.quota_timezone = tz;

    if (Object.keys(updates).length === 0) return;
    done.current = true;
    supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) done.current = false; // 실패 시 다음 기회에 재시도
      });
  }, [user, profile]);

  return null;
}
