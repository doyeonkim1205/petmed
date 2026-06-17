/**
 * 출혈·흑색변(melena) 감지 정규식 — 증상 텍스트로 출혈 위험을 서버 후처리에서 강제 격상.
 *
 * 한국어 패턴은 기존(symptom-analysis route 인라인)과 동일하게 유지하고, 영어 대안을
 * alternation 으로 덧붙였다(`i` 플래그는 한글에 영향 없음 → KO 회귀 없음).
 * "피"·"혈" 단독은 오탐(피부/피곤/빈혈)이 많아 제외 — 출혈을 뜻하는 복합어/영어 토큰만 매칭.
 */

// 일반 출혈 — 매칭 시 최소 medium 으로 격상.
export const BLOOD_RE =
  /혈변|혈뇨|토혈|혈토|객혈|각혈|하혈|잠혈|출혈|코피|혈담|선홍|피똥|피\s*똥|핏덩|핏물|피설사|피\s*설사|피를?\s*토|피를?\s*흘|피가?\s*나|피가?\s*섞|피\s*섞|피가?\s*묻|피\s*묻|붉은\s*피|빨간\s*피|bloody|bleeding|blood\s*in|h[ae]matochezia|h[ae]matemesis|h[ae]maturia|h[ae]morrhag|nosebleed/i;

// 흑색변(melena)·커피찌꺼기 토물 = 상부 위장관 출혈 — 매칭 시 high 로 격상.
export const MELENA_RE =
  /흑변|흑색변|검은\s*변|검은색\s*변|타르|짜장|커피\s*찌꺼기|커피색|melena|melaena|tarry\s*stool|tarry|coffee[-\s]?ground|black\s*tarry|black\s*stool/i;
