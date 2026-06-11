// 건강 통계 표시 지표 토글 — 사용자가 보고 싶은 지표만 노출 (localStorage 경량 저장).
// 기본: 체중·음수·식사 ON / 수액 OFF (수액은 니치). 전부 on/off 가능.

export type MetricTabId = 'weight' | 'water' | 'food' | 'fluid';

const KEY = 'pawdex_stats_tabs';
export const ALL_METRIC_TABS: MetricTabId[] = ['weight', 'water', 'food', 'fluid'];
const DEFAULT: MetricTabId[] = ['weight', 'water', 'food'];

export const STATS_TAB_LABELS: Record<MetricTabId, string> = {
  weight: '체중',
  water: '음수량',
  food: '식사',
  fluid: '수액',
};

/** 켜진 지표 목록. 미설정이면 기본값, 설정돼 있으면 그대로(빈 배열 가능). */
export function getEnabledStatsTabs(): MetricTabId[] {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return DEFAULT;
    const arr = JSON.parse(raw);
    return ALL_METRIC_TABS.filter((t) => Array.isArray(arr) && arr.includes(t));
  } catch {
    return DEFAULT;
  }
}

export function setEnabledStatsTabs(tabs: MetricTabId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ALL_METRIC_TABS.filter((t) => tabs.includes(t))));
  } catch {
    /* noop */
  }
}
