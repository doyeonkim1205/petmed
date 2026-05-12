/**
 * 수의학 영문 → 한국어 표준 용어 매핑.
 *
 * 목적:
 *   AI (GPT-4o-mini) 가 일부 의학 용어를 잘못 한국어로 번역하는 케이스 방어.
 *   예: "Feline Idiopathic Cystitis" → "모래주머니염" (오번역) 대신
 *       "고양이 특발성 방광염" 으로 보정.
 *
 * 적용 흐름:
 *   1. AI 가 diseases[].name_en 영문명 응답
 *   2. /api/symptom-analysis 라우트에서 lookupVetTerm(name_en) 호출
 *   3. 매핑 있으면 name_ko 강제 치환 (AI 의 한국어 번역 무시)
 *   4. 매핑 없으면 AI 의 한국어 그대로 (또는 프롬프트의 "영문 우선" 가이드에
 *      따라 영문이 들어와 있을 수 있음)
 *
 * 정책:
 *   - 핵심 30개만 매핑 (자주 등장하는 질환 우선, 80/20 법칙)
 *   - 사용자 피드백·실제 분석 결과에서 잘못된 번역 발견 시 점진 추가
 *   - 영문 키는 AI 응답이 보통 보내는 표기 (대소문자·약어 포함) 기준
 *
 * 매칭 전략:
 *   - 1차: exact match (정확히 같은 영문)
 *   - 2차: case-insensitive match (대소문자 차이 흡수)
 *   - 3차: prefix 약어 제외 ("(FIC)" 같은 괄호 약어 제거 후 비교)
 */

export const VET_TERM_MAP: Record<string, string> = {
  // ─────────────── 고양이 주요질환 (10) ───────────────
  'Feline Idiopathic Cystitis': '고양이 특발성 방광염',
  'Chronic Kidney Disease': '만성 신부전',
  'Hyperthyroidism': '갑상선 항진증',
  'Diabetes Mellitus': '당뇨병',
  'Hypertrophic Cardiomyopathy': '비대성 심근병증',
  'Feline Asthma': '고양이 천식',
  'Inflammatory Bowel Disease': '염증성 장 질환',
  'Hepatic Lipidosis': '지방간',
  'Upper Respiratory Infection': '상부 호흡기 감염',
  'Polycystic Kidney Disease': '다낭성 신장 질환',

  // ─────────────── 강아지 주요질환 (10) ───────────────
  'Patellar Luxation': '슬개골 탈구',
  'Otitis Externa': '외이염',
  'Atopic Dermatitis': '아토피성 피부염',
  'Hip Dysplasia': '고관절 이형성증',
  'Mitral Valve Disease': '승모판 폐쇄부전증',
  'Heartworm Disease': '심장사상충 감염',
  'Parvovirus Infection': '파보바이러스 감염',
  'Gastric Dilatation-Volvulus': '위확장-염전증후군',
  "Cushing's Syndrome": '쿠싱 증후군',
  "Addison's Disease": '애디슨병',

  // ─────────────── 공통·응급 증상 및 질환 (10) ───────────────
  'Pancreatitis': '췌장염',
  'Gastroenteritis': '위장염',
  'Bloat': '위팽창',
  'Seizure': '발작',
  'Anaphylaxis': '아나필락시스',
  'Hemorrhage': '출혈',
  'Heat Stroke': '열사병',
  'Hypoglycemia': '저혈당증',
  'Anemia': '빈혈',
  'Acute Renal Failure': '급성 신부전',
};

/**
 * 영문 의학 용어를 한국어 표준 용어로 변환.
 *
 * 매칭 우선순위:
 *   1. 정확 일치 (대소문자·공백 포함)
 *   2. 대소문자 무시 일치
 *   3. 괄호 약어 제거 후 일치 (예: "Feline Idiopathic Cystitis (FIC)" → 사전 키와 매칭)
 *
 * 매칭 실패 시: 입력 그대로 반환 (호출 측에서 fallback 으로 그대로 사용 가능).
 */
export function lookupVetTerm(englishTerm: string | null | undefined): string | null {
  if (!englishTerm) return null;
  const raw = englishTerm.trim();
  if (!raw) return null;

  // 1차: 정확 일치
  if (VET_TERM_MAP[raw]) return VET_TERM_MAP[raw];

  // 2차: 대소문자 무시
  const lowerRaw = raw.toLowerCase();
  for (const [key, value] of Object.entries(VET_TERM_MAP)) {
    if (key.toLowerCase() === lowerRaw) return value;
  }

  // 3차: 괄호 약어 제거 후 비교
  // "Feline Idiopathic Cystitis (FIC)" → "Feline Idiopathic Cystitis"
  const stripped = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (stripped !== raw) {
    if (VET_TERM_MAP[stripped]) return VET_TERM_MAP[stripped];
    const lowerStripped = stripped.toLowerCase();
    for (const [key, value] of Object.entries(VET_TERM_MAP)) {
      if (key.toLowerCase() === lowerStripped) return value;
    }
  }

  return null;
}
