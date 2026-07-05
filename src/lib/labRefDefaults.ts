// 검사 참고범위 "예시" 기본값 — 입력 보조용(자동 채우기 버튼).
// 값 출처: IDEXX Catalyst 예시값. ⚠️ 장비·검사기관·나이에 따라 달라지므로 "정답"이 아니라 예시.
// 앱은 판정하지 않음(정상/위험 표시 금지). 사용자가 결과지 기준으로 항상 수정.
// 임의 추정값 추가 금지 — 검증된 출처의 값만 넣을 것.
import type { Pet } from '@/lib/supabase';

export type AgeGroup = 'young' | 'adult';
type Range = [number, number];
type SpeciesDefaults = Partial<Record<AgeGroup, Range>>;

// key = labCatalog analyte key (대문자). unit 은 catalog defaultUnit 과 동일 전제.
// 데이터 입력 대기 중 — 검증된 값 받으면 아래에 추가. 형식 예:
//   ALP:  { dog: { young: [46, 337], adult: [23, 212] } },
//   PHOS: { dog: { young: [5.1, 10.4], adult: [2.5, 6.8] }, cat: { young: [4.5, 10.4], adult: [3.1, 7.5] } },
export const LAB_REF_DEFAULTS: Record<string, Partial<Record<Pet['type'], SpeciesDefaults>>> = {
};

// 만 12개월 미만 = young(어린 강아지/고양이), 그 외(성체·노령) = adult. 생일 미등록 시 adult.
export function ageGroupFor(birthDate?: string | null, refDateISO?: string): AgeGroup {
  if (!birthDate) return 'adult';
  const born = new Date(birthDate);
  if (isNaN(born.getTime())) return 'adult';
  const ref = refDateISO ? new Date(refDateISO) : new Date();
  const months = (ref.getFullYear() - born.getFullYear()) * 12 + (ref.getMonth() - born.getMonth());
  return months < 12 ? 'young' : 'adult';
}

// young 값이 없으면 adult 로 폴백.
export function refDefaultFor(analyteKey: string, type: Pet['type'], group: AgeGroup): Range | null {
  const s = LAB_REF_DEFAULTS[analyteKey]?.[type];
  if (!s) return null;
  return s[group] ?? s.adult ?? null;
}

export function speciesAgeLabel(type: Pet['type'], group: AgeGroup): string {
  if (type === 'dog') return group === 'young' ? '어린 강아지' : '성견';
  return group === 'young' ? '어린 고양이' : '성묘';
}
