/**
 * AI enum 정규화 — 모델이 한국어/영어 어느 쪽으로 enum 을 뱉어도 한국어 canonical 로 흡수.
 *
 * 배경: enum(severity/likelihood/응급등급)은 한국어 canonical 을 유지한다(서버 검증·UI 매핑이
 * 한국어 키 기준). 영어 프롬프트가 실수로 "Urgent"/"high" 등을 답하면 기존 fallback 이
 * '관찰'/'낮음' 으로 깔아 품질이 저하되므로, 여기서 EN→KO 로 흡수한 뒤 검증에 넘긴다.
 * 한국어 값은 항등 매핑이라 KO 경로는 동작 불변(회귀 없음).
 */
function pick(value: unknown, table: Record<string, string>, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (table[v]) return table[v];                 // 정확 매치 (KO canonical 포함)
  const low = v.toLowerCase();
  if (table[low]) return table[low];             // 영어 동의어 (대소문자 무시)
  return fallback;
}

// 질병 severity — canonical: 긴급 / 주의 / 관찰
const SEVERITY: Record<string, string> = {
  '긴급': '긴급', '주의': '주의', '관찰': '관찰',
  'urgent': '긴급', 'emergency': '긴급', 'critical': '긴급', 'severe': '긴급',
  'caution': '주의', 'warning': '주의', 'moderate': '주의',
  'watch': '관찰', 'monitor': '관찰', 'observe': '관찰', 'mild': '관찰', 'low': '관찰',
};
export function normalizeSeverity(v: unknown): '긴급' | '주의' | '관찰' {
  return pick(v, SEVERITY, '관찰') as '긴급' | '주의' | '관찰';
}

// likelihood — canonical: 높음 / 중간 / 낮음
const LIKELIHOOD: Record<string, string> = {
  '높음': '높음', '중간': '중간', '낮음': '낮음',
  'high': '높음', 'likely': '높음',
  'medium': '중간', 'moderate': '중간', 'intermediate': '중간',
  'low': '낮음', 'unlikely': '낮음',
};
export function normalizeLikelihood(v: unknown): '높음' | '중간' | '낮음' {
  return pick(v, LIKELIHOOD, '낮음') as '높음' | '중간' | '낮음';
}

// 응급 신호 severity — canonical: 즉시 / 24시간내 / 경과관찰
const EMERGENCY: Record<string, string> = {
  '즉시': '즉시', '24시간내': '24시간내', '경과관찰': '경과관찰',
  'immediate': '즉시', 'immediately': '즉시', 'now': '즉시', 'urgent': '즉시',
  'within24h': '24시간내', 'within 24h': '24시간내', '24h': '24시간내',
  'within 24 hours': '24시간내', '24 hours': '24시간내', 'within24hours': '24시간내',
  'monitor': '경과관찰', 'observe': '경과관찰', 'watch': '경과관찰',
};
export function normalizeEmergencySeverity(v: unknown): '즉시' | '24시간내' | '경과관찰' {
  return pick(v, EMERGENCY, '즉시') as '즉시' | '24시간내' | '경과관찰';
}
