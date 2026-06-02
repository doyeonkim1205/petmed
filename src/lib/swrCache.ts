/**
 * SWR 캐시 무효화 helper.
 *
 * 모든 무효화 호출을 한 곳에 모아 누락 / 키 충돌 / 동작 불일치를 줄임.
 */

import { mutate } from 'swr';

/** useHealthBriefing 캐시 key. userId 가 없으면 null (SWR 가 fetch 안 함). */
export function healthBriefingKey(userId: string | undefined | null): string | null {
  return userId ? `health-briefing-${userId}` : null;
}

/**
 * 펫/기록 mutation 직후 호출 — useHealthBriefing 캐시 무효화 + 강제 revalidate.
 *
 * { revalidate: true } 를 명시: dedupingInterval (2초) 안에 호출돼도 강제로 새
 * fetch 시작하도록 안전 보장. (mutate 기본도 revalidate=true 지만 명시가 안전.)
 */
export function invalidateHealthBriefing(userId: string | undefined | null) {
  const key = healthBriefingKey(userId);
  if (!key) return;
  mutate(key, undefined, { revalidate: true });
}

/**
 * 로그아웃 시 호출 — 모든 SWR 메모리 캐시 클리어.
 *
 * defense in depth: key 가 userId 별이라 자연 격리되지만, 공유 기기에서 다른
 * 사용자가 로그인하는 순간 캐시 잔존 시 이전 데이터가 잠깐 노출될 위험이 있음.
 * 매처 함수 `() => true` 로 모든 키 매치 + revalidate:false (로그아웃 후 fetch 불필요).
 */
export function clearAllSWRCache() {
  mutate(() => true, undefined, { revalidate: false });
}
