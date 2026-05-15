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
