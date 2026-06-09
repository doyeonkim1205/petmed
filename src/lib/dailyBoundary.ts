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
