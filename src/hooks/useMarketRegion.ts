'use client';

import { useAuth } from '@/contexts/AuthContext';
import { isMarketRegion, inferMarketRegion, defaultMarketRegion, type MarketRegion } from '@/lib/region';

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * 현재 서비스 지역. 우선순위: 프로필값 → 기기 타임존 추정 → 기본값(KR).
 *
 * 프로필 로드 전 잠깐은 추정값 fallback인데, 한국=Asia/Seoul→KR / 미국=US 타임존→US 라
 * 최종 프로필값과 일치해 화면이 튀지 않는다. (인증 게이트가 그 전엔 LoadingScreen을 띄움)
 */
export function useMarketRegion(): MarketRegion {
  const { profile } = useAuth();
  if (isMarketRegion(profile?.market_region)) {
    return profile!.market_region as MarketRegion;
  }
  return inferMarketRegion(deviceTimeZone()) ?? defaultMarketRegion;
}
