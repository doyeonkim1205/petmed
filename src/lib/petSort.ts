import type { Pet } from '@/lib/supabase';

/**
 * 기본 반려동물(localStorage 'defaultPetId') 을 항상 맨 위로 정렬.
 * 나머지는 created_at 오름차순 (등록 순서) 유지.
 *
 * 펫 목록 보여주는 모든 곳에서 사용:
 *   홈 브리핑 / 기록장 필터 / 새 기록 펫 선택 / 증상·사진 분석 펫 선택 /
 *   마이페이지 나의 반려동물 등.
 */
export function sortPetsWithDefault<T extends Pet>(pets: T[], defaultPetId: string | null | undefined): T[] {
  if (!defaultPetId || pets.length <= 1) return pets;
  const sorted = [...pets];
  sorted.sort((a, b) => {
    if (a.id === defaultPetId && b.id !== defaultPetId) return -1;
    if (b.id === defaultPetId && a.id !== defaultPetId) return 1;
    // 둘 다 default 아니거나 둘 다 default 면 created_at 오름차순
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
  return sorted;
}

/** SSR 안전 — window 없는 환경에서 null 반환. */
export function readDefaultPetId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('defaultPetId');
  } catch {
    return null;
  }
}
