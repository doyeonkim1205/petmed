/**
 * Returns the start-of-day (KST) as a UTC Date that can be used with
 * `.gte('created_at', ...)` for "today's usage" queries.
 *
 * Why not `new Date().setHours(0,0,0,0)`?
 *   Vercel runs in UTC, so that resets every day at 09:00 KST
 *   (midnight UTC). Korean users would see their daily allowance
 *   reset in the morning instead of at midnight.
 *
 * This helper converts "current KST calendar date midnight" back to
 * the equivalent UTC instant, which is what the DB stores.
 */
export function startOfDayKST(): Date {
  const now = new Date();
  // Shift now into KST "clock" by adding 9h, then zero the time.
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCHours(0, 0, 0, 0);
  // Shift back to UTC.
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000);
}

/**
 * Start-of-month (KST) as a UTC Date. 월 단위 사용량 창(Free 플랜 월 한도)용.
 * startOfDayKST 와 동일한 KST→UTC 변환 원리 — 이번 달 1일 0시(KST)의 UTC 인스턴트.
 */
export function startOfMonthKST(): Date {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCDate(1);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000);
}

/** 플랜의 한도 창에 맞는 시작 시각. 'month'=이번 달 1일, 'day'=오늘 자정 (KST 기준). */
export function startOfWindowKST(win: 'day' | 'month'): Date {
  return win === 'month' ? startOfMonthKST() : startOfDayKST();
}

/**
 * 'YYYY-MM-DD' (KST 달력 날짜) → 그 날의 KST 자정/끝을 UTC ISO 로 변환.
 * 어드민 로그 날짜 필터(from/to)용 — created_at(UTC timestamptz)과 비교할 때
 *   날짜 문자열을 그냥 쓰면 UTC 로 해석돼 KST 기준 9시간 어긋남.
 * 형식이 잘못됐거나 파싱 불가하면 null (필터를 적용하지 않게 함).
 */
export function kstDateToUtcRange(dateStr: string): { startIso: string; endIso: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00.000+09:00`);
  const end = new Date(`${dateStr}T23:59:59.999+09:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
