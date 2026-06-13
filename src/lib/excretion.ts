import type { ExcretionKind } from '@/lib/supabase';

// 대소변 상태/양/색 옵션 — 코드 ↔ 라벨 ↔ 색 매핑.
// UI 는 진단형 표현("탈수 의심" 등) 없이 상태명만 노출. 이상 신호는 색으로만 강조.

export interface Option { id: string; label: string; color: string; }

// 대변 상태 (Purina 변 점수 단순화). 정상=초록, 이상일수록 주황·빨강.
export const POOP_CONDITIONS: Option[] = [
  { id: 'normal',   label: '정상',   color: '#22C55E' },
  { id: 'soft',     label: '무름',   color: '#EAB308' },
  { id: 'diarrhea', label: '설사',   color: '#F97316' },
  { id: 'hard',     label: '딱딱함', color: '#A16207' },
  { id: 'blood',    label: '혈변',   color: '#DC2626' },
];

// 소변 상태 — 색 신호가 핵심. 정상=노랑, 이상=주황·빨강·회.
export const PEE_CONDITIONS: Option[] = [
  { id: 'normal', label: '정상',       color: '#EAB308' },
  { id: 'dark',   label: '진함',       color: '#F97316' },
  { id: 'blood',  label: '붉음',       color: '#DC2626' },
  { id: 'cloudy', label: '탁함',       color: '#9CA3AF' },
  { id: 'none',   label: '거의 못 봄', color: '#6B7280' },
];

export const AMOUNTS: Option[] = [
  { id: 'less',   label: '적음', color: '#9CA3AF' },
  { id: 'normal', label: '보통', color: '#22C55E' },
  { id: 'more',   label: '많음', color: '#3B82F6' },
];

// 대변 색
export const POOP_COLORS: Option[] = [
  { id: 'brown',  label: '갈색',   color: '#92400E' },
  { id: 'black',  label: '검은색', color: '#1F2937' },
  { id: 'red',    label: '붉은색', color: '#DC2626' },
  { id: 'yellow', label: '노란색', color: '#EAB308' },
  { id: 'gray',   label: '회색',   color: '#9CA3AF' },
];

export function conditionsFor(kind: ExcretionKind): Option[] {
  return kind === 'poop' ? POOP_CONDITIONS : PEE_CONDITIONS;
}

function find(opts: Option[], id?: string | null): Option | undefined {
  return id ? opts.find((o) => o.id === id) : undefined;
}

export function conditionMeta(kind: ExcretionKind, id: string): Option {
  return find(conditionsFor(kind), id) || { id, label: id, color: '#9CA3AF' };
}
export function amountLabel(id?: string | null): string | null {
  return find(AMOUNTS, id)?.label ?? null;
}
export function colorMeta(id?: string | null): Option | null {
  return find(POOP_COLORS, id) ?? null;
}

// 이상 상태 여부 (요약/강조용) — 정상 외 전부 이상으로 간주하되,
// 빨강(혈변/붉음)·주황(설사/진함) 은 더 강하게. 정상만 false.
export function isAbnormalCondition(kind: ExcretionKind, id: string): boolean {
  return id !== 'normal';
}
