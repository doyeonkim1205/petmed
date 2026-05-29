import redFlagsData from './redFlags.json';

/**
 * 치명적·전형적 감염성 질환의 "누락 금지" 레드플래그.
 *
 * 긴 프롬프트에 묻혀 약해지는 prose 규칙 대신, 입력 증상에 매칭될 때만
 * 짧은 힌트를 주입해 신뢰성↑ + 프롬프트는 가볍게 유지.
 *   - all: 동의어 그룹 배열. 그룹 간 AND, 그룹 내 OR (모든 그룹에 하나씩 매칭돼야 발동)
 *   - 데이터는 redFlags.json 공유 (앱 + 회귀 테스트가 동일 소스 사용 → drift 방지)
 */
export type RedFlag = {
  id: string;
  species: 'dog' | 'cat' | 'any';
  all: string[][];
  hint: string;
};

export const RED_FLAGS = redFlagsData as RedFlag[];

/** 공백 무시 매칭 — "피 섞인" 과 "피섞인" 동일 취급. */
export function matchRedFlags(species: 'cat' | 'dog', text: string): string[] {
  const t = (text || '').replace(/\s+/g, '');
  return RED_FLAGS
    .filter(
      (rf) =>
        (rf.species === 'any' || rf.species === species) &&
        rf.all.every((group) => group.some((kw) => t.includes(kw))),
    )
    .map((rf) => rf.hint);
}
