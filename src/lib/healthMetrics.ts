// 건강 지표(음수/식사/수액) 공통 타입·메타·적정량 계산.

export type MetricType = 'water' | 'food' | 'fluid';

export interface HealthMetric {
  id: string;
  user_id: string;
  pet_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  measured_at: string;
  memo?: string | null;
  created_at?: string;
}

export const METRIC_META: Record<MetricType, { label: string; unit: string; color: string; placeholder: string }> = {
  water: { label: '음수량', unit: 'ml', color: '#0ea5e9', placeholder: '오늘 마신 물 (ml)' },
  food: { label: '식사량', unit: 'g', color: '#f59e0b', placeholder: '오늘 먹은 사료 (g)' },
  fluid: { label: '수액', unit: 'ml', color: '#8b5cf6', placeholder: '투여한 수액 (ml)' },
};

export const METRIC_ORDER: MetricType[] = ['water', 'food', 'fluid'];

/**
 * 적정 음수량(ml/일) — 종·체중 기반 참고 범위.
 *   개 약 50~60 ml/kg, 고양이 약 45~55 ml/kg. 습식/건식·기온·개체차로 달라짐(참고용).
 */
export function waterTargetRange(species: 'dog' | 'cat', weightKg: number): { low: number; high: number } | null {
  if (!weightKg || weightKg <= 0) return null;
  if (species === 'cat') return { low: Math.round(weightKg * 45), high: Math.round(weightKg * 55) };
  return { low: Math.round(weightKg * 50), high: Math.round(weightKg * 60) };
}

/**
 * 지표별 적정 범위.
 *  - water: 종·체중 자동 (참고).
 *  - food: 사료 칼로리 의존이라 자동 기준 제시 X (포장 급여표 참고 안내).
 *  - fluid: 수의사 처방값이라 자동 기준 X.
 */
export function metricTargetRange(type: MetricType, species: 'dog' | 'cat', weightKg: number): { low: number; high: number } | null {
  if (type === 'water') return waterTargetRange(species, weightKg);
  return null;
}

/** 적정량 안내 문구 (입력 힌트·요약용). */
export function metricTargetHint(type: MetricType, target: { low: number; high: number } | null): string {
  if (type === 'food') return '사료 포장의 급여 가이드를 참고하세요';
  if (type === 'fluid') return '수의사 처방량을 기준으로 기록하세요';
  if (target) return `권장 약 ${target.low}~${target.high}ml`;
  return '반려동물 체중을 등록하면 적정량을 알려드려요';
}
