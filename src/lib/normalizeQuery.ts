/**
 * 검색어 정규형 — 앞뒤·내부 공백을 모두 제거하고 소문자화.
 *
 * "신장 결석"과 "신장결석"처럼 띄어쓰기만 다른 검색어를 같은 키로 취급하기 위해
 * 질병 사전(diseaseMap) 조회와 검색 캐시 키 비교에 공통으로 사용한다.
 *
 * ⚠️ 이 정규형은 "키 매칭·캐시 키" 전용이다. LLM 번역 프롬프트나 PubMed 로 넘기는
 * 실제 쿼리에는 정규형이 아니라 원문(trim 만 한)을 넘겨 자연스러운 번역을 유지한다.
 */
export function normalizeQuery(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}
