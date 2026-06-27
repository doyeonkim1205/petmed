// 건강 통계 표시 지표 토글 — 사용자가 보고 싶은 지표만 노출 (localStorage 경량 저장).
// 기본: 체중·음수·식사 ON / 수액 OFF (수액은 니치). 전부 on/off 가능.

export type MetricTabId = 'weight' | 'water' | 'food' | 'fluid' | 'excretion' | 'respiratory';

const KEY = 'pawdex_stats_tabs';
export const ALL_METRIC_TABS: MetricTabId[] = ['weight', 'water', 'food', 'fluid', 'excretion', 'respiratory'];
// 기본: 체중·음수·식사 ON / 수액·대소변·호흡수 OFF (니치 — 필요한 사람만 켬, 기존 유저 화면 유지)
const DEFAULT: MetricTabId[] = ['weight', 'water', 'food'];

export const STATS_TAB_LABELS: Record<MetricTabId, string> = {
  weight: '체중',
  water: '음수량',
  food: '식사',
  fluid: '수액',
  excretion: '대소변',
  respiratory: '호흡수',
};

// 유효 id 만, 중복 제거, 입력 순서 보존.
function sanitize(arr: unknown): MetricTabId[] {
  const seen = new Set<string>();
  const out: MetricTabId[] = [];
  if (Array.isArray(arr)) {
    for (const t of arr) {
      if ((ALL_METRIC_TABS as string[]).includes(t) && !seen.has(t)) { seen.add(t); out.push(t as MetricTabId); }
    }
  }
  return out;
}

/** 켜진 지표 목록 (사용자 지정 순서 보존). 미설정이면 기본값. */
export function getEnabledStatsTabs(): MetricTabId[] {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return DEFAULT;
    return sanitize(JSON.parse(raw)); // 저장된 순서 그대로 (ALL_METRIC_TABS 순서로 재정렬 안 함)
  } catch {
    return DEFAULT;
  }
}

/** 켜진 지표 + 순서를 그대로 저장 (재정렬하지 않음 → 사용자 순서 유지). */
export function setEnabledStatsTabs(tabs: MetricTabId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitize(tabs)));
  } catch {
    /* noop */
  }
}
