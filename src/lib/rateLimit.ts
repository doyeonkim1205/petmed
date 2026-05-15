/**
 * In-memory per-user/endpoint rate limit.
 *
 * 왜 in-memory 인가:
 *   - DB 쿼리 없이 즉시 차단 → 0ms 지연
 *   - Redis / Upstash 같은 외부 인프라 X
 *   - Vercel 함수 인스턴스마다 별도 Map → 완벽 공유는 X
 *   - 3 인스턴스면 실질 3배 허용될 수 있지만 "10/min" → 최대 30/min 수준이라
 *     버스트 공격 방어에는 충분
 *
 * 저장 형식: Map<key, number[]> — key 마다 최근 타임스탬프 배열
 * 자동 정리: Map 사이즈가 커지면 각 키의 stale 엔트리 제거, 빈 키 삭제
 */

const store = new Map<string, number[]>();

/**
 * 지정 키가 window 내에 maxRequests 를 초과했는지 체크.
 * 초과 안 했으면 현재 시각을 기록하고 true 반환, 초과했으면 false.
 *
 * @param key         구분자 (보통 `${userId}:${endpoint}`)
 * @param maxRequests 허용 횟수
 * @param windowMs    시간 창 (밀리초)
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const requests = store.get(key) || [];
  const recent = requests.filter((t) => t > cutoff);

  if (recent.length >= maxRequests) {
    // 초과: 저장은 하지 않음 (실패도 카운트하면 유저 복구 불가)
    store.set(key, recent);
    return false;
  }

  recent.push(now);
  store.set(key, recent);

  // 주기적 정리 — 1000 키 넘으면 stale 제거
  if (store.size > 1000) {
    for (const [k, times] of store) {
      const alive = times.filter((t) => t > cutoff);
      if (alive.length === 0) store.delete(k);
      else store.set(k, alive);
    }
  }

  return true;
}
