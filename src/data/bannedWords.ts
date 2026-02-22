/**
 * Korean banned words filter for search input.
 * Checked BEFORE OpenAI call to save API costs.
 * Includes: profanity, slurs, sexual terms, common spam patterns.
 */

const bannedPatterns: string[] = [
  // 욕설/비속어
  '시발', '씨발', '씨팔', '씨방', 'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ',
  '개새끼', '새끼', '병신', 'ㅂㅅ', '미친놈', '미친년', '지랄',
  '좆', '닥쳐', '꺼져', '엿먹', '개좆', '존나', 'ㅈㄴ',
  '느금마', '니애미', '니엄마', '니미', '염병', '빡대가리',
  '멍청', '바보', '등신', '찐따',
  // 19금/성인
  '야동', '포르노', 'porn', 'sex', '섹스', '자위', '성인',
  '야한', '음란', '노출', '매춘', '원조교제', '성매매',
  'nude', 'nsfw', 'xxx', 'hentai', '변태',
  // 마약/불법
  '마약', '대마', '필로폰', '코카인', '메스',
  // 폭력
  '자살', '살인', '죽여', '죽이',
  // 스팸/무의미
  'ㅋㅋㅋ', 'ㅎㅎㅎ', 'asdf', 'qwer', 'test', '테스트',
  'ㅁㄴㅇㄹ', 'zxcv',
];

/**
 * Check if a query contains banned words.
 * Returns the matched word if found, null if clean.
 */
export function checkBannedWords(query: string): string | null {
  const lower = query.toLowerCase().replace(/\s/g, '');
  for (const word of bannedPatterns) {
    if (lower.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}
