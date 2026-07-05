// 검사 "기본 참고범위" — 입력 보조용(자동 채우기). 판정 아님, 사용자가 결과지 기준으로 항상 수정.
// ⚠️ "정상범위" 아님 → 반드시 "기본 참고범위". 장비·검사기관·방법에 따라 다름.
// 값 출처: IDEXX Catalyst / ProCyte Dx / TAMU GI Lab / Cornell / IRIS 등 공개 참고구간(사용자 제공).
// 나이 구분: 검사일 기준 만 1세 미만 = young, 그 외(성체·노령) = adult. 생일 미입력 = adult.
// CBC 는 전연령 공통(adult 만 넣어 young 이 폴백). 한쪽 범위는 op 로 원문 기호(<,≤,>,≥) 보존.
import type { Pet } from '@/lib/supabase';

export type AgeGroup = 'young' | 'adult';
export type RefDefault =
  | { low: number; high: number }                       // 양측 (7–27)
  | { op: '<' | '<=' | '>' | '>='; value: number }      // 한쪽 (<0.2, ≥10.9) — 원문 기호 보존
  | { text: string };                                   // 선택형/텍스트 (음성)
type Slot = Partial<Record<AgeGroup, RefDefault>>;
type Entry = Partial<Record<Pet['type'], Slot>>;

// key = labCatalog analyte key (대문자). 단위는 카탈로그 defaultUnit 과 동일 전제.
// 자동 안 넣음(결과지 기준 입력): BA, BP, TCO2, FT4, TSH, CORT, NTPROBNP, HR, 소변 Crystal/Bacteria/Cast/Epi.
export const LAB_REF_DEFAULTS: Record<string, Entry> = {
  // ── 혈액검사 CBC (전연령 공통, ProCyte Dx) ──
  WBC:  { dog: { adult: { low: 5.05, high: 16.76 } }, cat: { adult: { low: 2.87, high: 17.02 } } },
  NEU:  { dog: { adult: { low: 2.95, high: 11.64 } }, cat: { adult: { low: 2.30, high: 10.29 } } },
  LYM:  { dog: { adult: { low: 1.05, high: 5.10 } },  cat: { adult: { low: 0.92, high: 6.88 } } },
  MONO: { dog: { adult: { low: 0.16, high: 1.12 } },  cat: { adult: { low: 0.05, high: 0.67 } } },
  EOS:  { dog: { adult: { low: 0.06, high: 1.23 } },  cat: { adult: { low: 0.17, high: 1.57 } } },
  RBC:  { dog: { adult: { low: 5.65, high: 8.87 } },  cat: { adult: { low: 6.54, high: 12.20 } } },
  HGB:  { dog: { adult: { low: 13.1, high: 20.5 } },  cat: { adult: { low: 9.8, high: 16.2 } } },
  HCT:  { dog: { adult: { low: 37.3, high: 61.7 } },  cat: { adult: { low: 30.3, high: 52.3 } } },
  MCV:  { dog: { adult: { low: 61.6, high: 73.5 } },  cat: { adult: { low: 35.9, high: 53.1 } } },
  MCHC: { dog: { adult: { low: 32.0, high: 37.9 } },  cat: { adult: { low: 28.1, high: 35.8 } } },
  PLT:  { dog: { adult: { low: 148, high: 484 } },    cat: { adult: { low: 151, high: 600 } } },

  // ── 간 수치 (young/adult, Catalyst) ──
  ALT:  { dog: { young: { low: 8, high: 75 },  adult: { low: 10, high: 125 } }, cat: { young: { low: 12, high: 115 }, adult: { low: 12, high: 130 } } },
  AST:  { dog: { young: { low: 0, high: 50 },  adult: { low: 0, high: 50 } },   cat: { young: { low: 0, high: 32 },  adult: { low: 0, high: 48 } } },
  ALP:  { dog: { young: { low: 46, high: 337 }, adult: { low: 23, high: 212 } }, cat: { young: { low: 14, high: 192 }, adult: { low: 14, high: 111 } } },
  GGT:  { dog: { young: { low: 0, high: 2 },   adult: { low: 0, high: 11 } },   cat: { young: { low: 0, high: 1 },   adult: { low: 0, high: 4 } } },
  TBIL: { dog: { young: { low: 0.0, high: 0.8 }, adult: { low: 0.0, high: 0.9 } }, cat: { young: { low: 0.0, high: 0.9 }, adult: { low: 0.0, high: 0.9 } } },
  ALB:  { dog: { young: { low: 2.1, high: 3.6 }, adult: { low: 2.3, high: 4.0 } }, cat: { young: { low: 2.2, high: 3.9 }, adult: { low: 2.2, high: 4.0 } } },
  TP:   { dog: { young: { low: 4.8, high: 7.2 }, adult: { low: 5.2, high: 8.2 } }, cat: { young: { low: 5.2, high: 8.2 }, adult: { low: 5.7, high: 8.9 } } },
  GLOB: { dog: { young: { low: 2.3, high: 3.8 }, adult: { low: 2.5, high: 4.5 } }, cat: { young: { low: 2.8, high: 4.8 }, adult: { low: 2.8, high: 5.1 } } },
  CHOL: { dog: { young: { low: 100, high: 400 }, adult: { low: 110, high: 320 } }, cat: { young: { low: 62, high: 191 }, adult: { low: 65, high: 225 } } },

  // ── 신장 수치 ──
  BUN:  { dog: { young: { low: 7, high: 29 },  adult: { low: 7, high: 27 } },   cat: { young: { low: 16, high: 33 }, adult: { low: 16, high: 36 } } },
  CREA: { dog: { young: { low: 0.3, high: 1.2 }, adult: { low: 0.5, high: 1.8 } }, cat: { young: { low: 0.6, high: 1.6 }, adult: { low: 0.8, high: 2.4 } } },
  SDMA: { dog: { young: { low: 0, high: 16 },  adult: { low: 0, high: 14 } },   cat: { young: { low: 0, high: 14 }, adult: { low: 0, high: 14 } } },
  USG:  { dog: { adult: { low: 1.015, high: 1.045 } }, cat: { adult: { low: 1.035, high: 1.060 } } },
  UPC:  { dog: { adult: { op: '<', value: 0.2 } }, cat: { adult: { op: '<', value: 0.2 } } },

  // ── 전해질 (Na/K/Cl/Ca/Phos 는 신장과 동일 key → 한 번만 정의해도 양쪽 카테고리 적용) ──
  NA:   { dog: { young: { low: 145, high: 157 }, adult: { low: 144, high: 160 } }, cat: { young: { low: 150, high: 165 }, adult: { low: 150, high: 165 } } },
  K:    { dog: { young: { low: 3.5, high: 5.5 }, adult: { low: 3.5, high: 5.8 } }, cat: { young: { low: 3.7, high: 5.9 }, adult: { low: 3.5, high: 5.8 } } },
  CL:   { dog: { young: { low: 105, high: 119 }, adult: { low: 109, high: 122 } }, cat: { young: { low: 115, high: 126 }, adult: { low: 112, high: 129 } } },
  CA:   { dog: { young: { low: 7.8, high: 12.6 }, adult: { low: 7.9, high: 12.0 } }, cat: { young: { low: 7.9, high: 11.3 }, adult: { low: 7.8, high: 11.3 } } },
  PHOS: { dog: { young: { low: 5.1, high: 10.4 }, adult: { low: 2.5, high: 6.8 } }, cat: { young: { low: 4.5, high: 10.4 }, adult: { low: 3.1, high: 7.5 } } },
  MG:   { dog: { young: { low: 1.20, high: 2.04 }, adult: { low: 1.40, high: 2.38 } }, cat: { young: { low: 1.62, high: 2.23 }, adult: { low: 1.50, high: 3.00 } } },

  // ── 당·호르몬 ──
  GLU:  { dog: { young: { low: 77, high: 150 }, adult: { low: 74, high: 143 } }, cat: { young: { low: 77, high: 153 }, adult: { low: 74, high: 159 } } },
  FRUC: { dog: { adult: { low: 177, high: 314 } }, cat: { adult: { low: 191, high: 349 } } },
  T4:   { dog: { adult: { low: 1.0, high: 4.0 } },  cat: { adult: { low: 0.8, high: 4.7 } } },

  // ── 췌장·소화기 ──
  AMYL: { dog: { young: { low: 300, high: 1300 }, adult: { low: 500, high: 1500 } }, cat: { young: { low: 500, high: 1400 }, adult: { low: 500, high: 1500 } } },
  LIP:  { dog: { young: { low: 100, high: 1500 }, adult: { low: 200, high: 1800 } }, cat: { young: { low: 40, high: 500 }, adult: { low: 100, high: 1400 } } },
  FPL:  { cat: { adult: { op: '<=', value: 4.4 } } },   // Spec fPL — 고양이용
  CPL:  { dog: { adult: { op: '<', value: 200 } } },    // Spec cPL — 강아지용
  TLI:  { dog: { adult: { op: '>=', value: 10.9 } }, cat: { adult: { low: 12.0, high: 82.0 } } },
  COB:  { dog: { adult: { low: 251, high: 908 } }, cat: { adult: { low: 290, high: 1500 } } },
  FOL:  { dog: { adult: { low: 7.7, high: 24.4 } }, cat: { adult: { low: 9.7, high: 21.6 } } },

  // ── 심장·염증 ──
  TROPI: { dog: { adult: { low: 0, high: 0.07 } }, cat: { adult: { low: 0, high: 0.16 } } },
  CRP:   { dog: { adult: { low: 0, high: 10 } } },      // 강아지만
  SAA:   { cat: { adult: { low: 0, high: 5.4 } } },     // 고양이만
  FIB:   { dog: { adult: { low: 150, high: 490 } }, cat: { adult: { low: 76, high: 270 } } },

  // ── 소변검사 (딥스틱=음성 텍스트, 침사 WBC/RBC=0–5. Crystal/Bacteria/Cast/Epi 는 비움) ──
  URINE_PH:      { dog: { adult: { low: 5.5, high: 8.5 } }, cat: { adult: { low: 5.5, high: 8.5 } } },
  URINE_PROTEIN: { dog: { adult: { text: '음성' } }, cat: { adult: { text: '음성' } } },
  URINE_GLU:     { dog: { adult: { text: '음성' } }, cat: { adult: { text: '음성' } } },
  URINE_KET:     { dog: { adult: { text: '음성' } }, cat: { adult: { text: '음성' } } },
  URINE_BLD:     { dog: { adult: { text: '음성' } }, cat: { adult: { text: '음성' } } },
  URINE_BIL:     { dog: { adult: { text: '음성' } }, cat: { adult: { text: '음성' } } },
  URINE_WBC:     { dog: { adult: { low: 0, high: 5 } }, cat: { adult: { low: 0, high: 5 } } },
  URINE_RBC:     { dog: { adult: { low: 0, high: 5 } }, cat: { adult: { low: 0, high: 5 } } },
};

// 검사일 기준 만 1세 미만 = young (일 단위 정확). 생일 미입력 = adult.
export function ageGroupFor(birthDate?: string | null, refDateISO?: string): AgeGroup {
  if (!birthDate) return 'adult';
  const born = new Date(birthDate);
  if (isNaN(born.getTime())) return 'adult';
  const firstBirthday = new Date(born);
  firstBirthday.setFullYear(firstBirthday.getFullYear() + 1);
  const ref = refDateISO ? new Date(refDateISO) : new Date();
  return ref < firstBirthday ? 'young' : 'adult';
}

// young 값이 없으면 adult 로 폴백(CBC 등 전연령 공통).
export function refDefaultFor(analyteKey: string, type: Pet['type'], group: AgeGroup): RefDefault | null {
  const s = LAB_REF_DEFAULTS[analyteKey]?.[type];
  if (!s) return null;
  return s[group] ?? s.adult ?? null;
}

export function speciesAgeLabel(type: Pet['type'], group: AgeGroup): string {
  if (type === 'dog') return group === 'young' ? '어린 강아지' : '성견';
  return group === 'young' ? '어린 고양이' : '성묘';
}

// op → 표시 기호. 한쪽 범위 원문 보존용.
export function opSymbol(op: '<' | '<=' | '>' | '>='): string {
  return op === '<' ? '<' : op === '<=' ? '≤' : op === '>' ? '>' : '≥';
}
