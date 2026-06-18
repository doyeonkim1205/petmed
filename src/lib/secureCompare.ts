import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 상수 시간(constant-time) 문자열 비교 — 타이밍 공격 방지.
 *
 * 일반 `a === b` 는 다른 글자를 만나면 즉시 반환해서, 비교에 걸린 시간이
 * "앞에서 몇 글자 일치했는가"를 누설할 수 있다(이론적 타이밍 공격).
 * 두 값을 SHA-256(고정 길이)으로 해시한 뒤 timingSafeEqual 로 비교하면
 * 길이 차이 누설 없이 항상 동일 시간이 걸린다.
 *
 * 웹훅/크론 시크릿 검증처럼 "서버가 가진 비밀과 요청 헤더를 대조" 하는 곳에 사용.
 */
export function secureEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
