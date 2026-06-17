import redFlagsData from './redFlags.json';

/**
 * 치명적·전형적 감염성 질환의 "누락 금지" 레드플래그.
 *
 * 긴 프롬프트에 묻혀 약해지는 prose 규칙 대신, 입력 증상에 매칭될 때만
 * 짧은 힌트를 주입해 신뢰성↑ + 프롬프트는 가볍게 유지.
 *   - all: 동의어 그룹 배열. 그룹 간 AND, 그룹 내 OR (모든 그룹에 하나씩 매칭돼야 발동)
 *   - 데이터는 redFlags.json 공유 (앱 + 회귀 테스트가 동일 소스 사용 → drift 방지)
 *   - 그룹 키워드에 한국어+영어를 함께 둬 EN 입력도 동일 규칙으로 감지.
 *   - concernFloor: 매칭 시 서버 후처리에서 강제할 concern_level 하한.
 */
export type RedFlag = {
  id: string;
  species: 'dog' | 'cat' | 'any';
  /** 매칭 시 보정할 concern_level 하한 (치명 감염성=high, 그 외=medium) */
  concernFloor: 'high' | 'medium';
  all: string[][];
  hint: string;
  hint_en: string;
};

export const RED_FLAGS = redFlagsData as RedFlag[];

/** 매칭된 레드플래그 (locale 별 힌트 + concern 하한). */
export type MatchedRedFlag = { id: string; hint: string; concernFloor: 'high' | 'medium' };

/**
 * 공백 무시 + 소문자화 매칭 — "피 섞인"="피섞인", "Bloody"="bloody".
 * 한글은 toLowerCase 영향 없음(회귀 없음), 영어만 대소문자 흡수.
 */
function matchFlags(species: 'cat' | 'dog', text: string): RedFlag[] {
  const t = (text || '').toLowerCase().replace(/\s+/g, '');
  return RED_FLAGS.filter(
    (rf) =>
      (rf.species === 'any' || rf.species === species) &&
      rf.all.every((group) => group.some((kw) => t.includes(kw))),
  );
}

/** (하위호환) 한국어 힌트 문자열만 반환. */
export function matchRedFlags(species: 'cat' | 'dog', text: string): string[] {
  return matchFlags(species, text).map((rf) => rf.hint);
}

/** locale 별 힌트 + concern 하한을 함께 반환 (프롬프트 주입 + 후처리 보정용). */
export function matchRedFlagsDetailed(
  species: 'cat' | 'dog',
  text: string,
  locale: 'ko' | 'en',
): MatchedRedFlag[] {
  return matchFlags(species, text).map((rf) => ({
    id: rf.id,
    hint: locale === 'en' ? rf.hint_en : rf.hint,
    concernFloor: rf.concernFloor,
  }));
}
