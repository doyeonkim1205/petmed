/**
 * 한국어 질병명 → 영문 PubMed 검색어 매핑
 */

export const diseaseMap: Record<string, string> = {
  // 소화기
  '구토': 'vomiting',
  '설사': 'diarrhea',
  '췌장염': 'pancreatitis',
  '위염': 'gastritis',
  '장염': 'enteritis',
  '이물섭식': 'foreign body ingestion',
  '식욕부진': 'anorexia',
  '구취': 'halitosis',

  // 신장/비뇨기
  '신부전': 'renal failure',
  '만성 신부전': 'chronic kidney disease',
  '급성 신부전': 'acute kidney injury',
  '방광염': 'cystitis',
  '요로결석': 'urolithiasis',
  '혈뇨': 'hematuria',

  // 내분비
  '당뇨': 'diabetes mellitus',
  '당뇨병': 'diabetes mellitus',
  '갑상선 기능 항진증': 'hyperthyroidism',
  '쿠싱 증후군': 'hyperadrenocorticism',
  '애디슨병': 'hypoadrenocorticism',
  '비만': 'obesity',

  // 근골격
  '슬개골 탈구': 'patellar luxation',
  '고관절 이형성': 'hip dysplasia',
  '추간판 질환': 'intervertebral disc disease',
  '골관절염': 'osteoarthritis',
  '관절염': 'arthritis',
  '십자인대 파열': 'cranial cruciate ligament rupture',

  // 피부
  '피부염': 'dermatitis',
  '아토피': 'atopic dermatitis',
  '알레르기성 피부염': 'allergic dermatitis',
  '피부 감염': 'skin infection',
  '탈모': 'alopecia',
  '귀 진드기': 'ear mites',

  // 눈
  '백내장': 'cataract',
  '녹내장': 'glaucoma',
  '결막염': 'conjunctivitis',
  '각막염': 'keratitis',

  // 구강
  '치주질환': 'periodontal disease',
  '치주염': 'periodontitis',
  '치은염': 'gingivitis',
  '구내염': 'stomatitis',

  // 호흡기
  '기관 허탈': 'tracheal collapse',
  '기침': 'cough',
  '천식': 'asthma',
  '상부 호흡기 감염': 'upper respiratory infection',

  // 심혈관
  '심장사상충': 'heartworm disease',
  '심장병': 'heart disease',

  // 간
  '간질환': 'liver disease',
  '지방간': 'hepatic lipidosis',

  // 신경
  '간질': 'epilepsy',
  '발작': 'seizure',

  // 귀
  '외이염': 'otitis externa',

  // 종양
  '소화기 림프종': 'gastrointestinal lymphoma',
  '림프종': 'lymphoma',
  '비만세포종': 'mast cell tumor',
  '유선종양': 'mammary tumor',

  // 감염병 (고양이)
  '고양이 전염성 복막염': 'feline infectious peritonitis',
  '전염성 복막염': 'feline infectious peritonitis',
  'FIP': 'feline infectious peritonitis',
  '범백혈구감소증': 'feline panleukopenia',
  '고양이 허피스': 'feline herpesvirus',
  '허피스 바이러스': 'feline herpesvirus',
  '칼리시 바이러스': 'feline calicivirus',
  '고양이 감기': 'feline upper respiratory infection',

  // 감염병 (강아지)
  '파보바이러스': 'canine parvovirus',
  '파보 바이러스': 'canine parvovirus',
  '켄넬코프': 'kennel cough',
  '디스템퍼': 'canine distemper',
  '코로나 장염': 'canine coronavirus enteritis',
};

// 번역 결과 캐시 — localStorage 기반으로 새로고침 후에도 유지
const LS_KEY = 'pawdex_translation_cache';

function loadCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

function saveToCache(key: string, value: string) {
  if (typeof window === 'undefined') return;
  const cache = loadCache();
  cache[key] = value;
  localStorage.setItem(LS_KEY, JSON.stringify(cache));
}

// Lazy-load: avoid module-level localStorage access (causes SSR/hydration issues on mobile)
let translationCache: Record<string, string> | null = null;
function getCache(): Record<string, string> {
  if (!translationCache) translationCache = loadCache();
  return translationCache;
}

/**
 * MyMemory API로 한국어 → 영어 번역
 */
async function translateWithMyMemory(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ko|en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory API failed: ${res.status}`);

  const data = await res.json();
  const translated: string = data.responseData?.translatedText ?? '';

  // MyMemory가 번역 실패 시 원문을 그대로 돌려주는 경우 체크
  if (!translated || translated === text) {
    return text;
  }

  return translated;
}

/**
 * 한국어 질병명을 PubMed 검색용 영문 검색어로 변환
 *
 * 4단계 폴백:
 * 1. 정확 매치 (딕셔너리 키와 동일)
 * 2. 부분 매치 (딕셔너리 키가 입력에 포함되거나 입력이 키에 포함)
 * 3. 괄호 안 영문 추출 (예: "슬개골 탈구 (Patellar Luxation)")
 * 4. MyMemory 번역 API 호출
 */
export async function toEnglishQuery(koreanName: string): Promise<string> {
  const trimmed = koreanName.trim();

  // 이미 영문이면 그대로 반환
  if (/^[A-Za-z\s\-]+$/.test(trimmed)) {
    return trimmed;
  }

  // 1) 정확 매치
  if (diseaseMap[trimmed]) {
    return diseaseMap[trimmed];
  }

  // 2) 부분 매치 — 가장 긴 키부터 시도
  const sortedKeys = Object.keys(diseaseMap).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedKeys) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return diseaseMap[key];
    }
  }

  // 3) 괄호 안 영문 추출
  const parenMatch = trimmed.match(/\(([A-Za-z\s]+)\)/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }

  // 4) 번역 캐시 확인
  const cache = getCache();
  if (cache[trimmed]) {
    return cache[trimmed];
  }

  // 5) MyMemory API 번역 폴백
  try {
    const translated = await translateWithMyMemory(trimmed);
    cache[trimmed] = translated;
    saveToCache(trimmed, translated);
    return translated;
  } catch {
    // 번역 실패 시 원문 그대로 반환
    return trimmed;
  }
}
