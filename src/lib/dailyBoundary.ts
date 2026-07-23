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

// ─── 임의 IANA 타임존 기준 경계 (유저 한도용 — 계정 quota_timezone) ───────────
// KST 고정(startOfDayKST 등)의 일반화. tz 가 비었/잘못되면 'Asia/Seoul'(=기존 동작) 폴백.
// ⚠️ 어드민/크론은 KST 함수를 그대로 쓰고, 유저 한도 라우트만 이걸 쓴다.

// (tz 벽시계 - UTC) 오프셋 ms. DST 포함 정확.
function tzOffsetMs(tz: string, at: Date): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return asUTC - at.getTime();
}

function startOfUnitInTz(tz: string, unit: 'day' | 'month', now: Date): Date {
  let safeTz = tz || 'Asia/Seoul';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    safeTz = 'Asia/Seoul';
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const g = (t: string) => Number(parts.find((x) => x.type === t)!.value);
  const y = g('year'), m = g('month'), d = unit === 'month' ? 1 : g('day');
  const guessUTC = Date.UTC(y, m - 1, d, 0, 0, 0);
  // 2-pass: DST 전환일 보정 (guess 시점 오프셋 → 결과 시점 오프셋으로 재계산)
  let off = tzOffsetMs(safeTz, new Date(guessUTC));
  off = tzOffsetMs(safeTz, new Date(guessUTC - off));
  return new Date(guessUTC - off);
}

/** 해당 타임존의 '오늘 자정'을 UTC Date 로. */
export function startOfDayInTz(tz: string, now: Date = new Date()): Date {
  return startOfUnitInTz(tz, 'day', now);
}
/** 해당 타임존의 '이번 달 1일 자정'을 UTC Date 로. */
export function startOfMonthInTz(tz: string, now: Date = new Date()): Date {
  return startOfUnitInTz(tz, 'month', now);
}
/** 플랜 창(day/month)에 맞는 시작 — 계정 타임존 기준. */
export function startOfWindowInTz(win: 'day' | 'month', tz: string, now: Date = new Date()): Date {
  return win === 'month' ? startOfMonthInTz(tz, now) : startOfDayInTz(tz, now);
}
