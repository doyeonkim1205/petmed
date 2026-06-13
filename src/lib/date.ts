/**
 * 시간대 안전한 날짜 헬퍼.
 *
 * ⚠️ new Date().toISOString().split('T')[0] 는 UTC 자정 기준이라
 * 한국 시간 새벽 0~9시 사이에 "어제" ISO date 반환 → 사용자 디바이스의
 * 캘린더 날짜와 하루 어긋남.
 *
 * 사용자가 입력하는 form 의 date input default / max / 비교용 today 등에는
 * todayLocalISO() 를 사용해 사용자 시계 기준 자정으로 통일.
 */

/**
 * 오늘 날짜 (사용자 로컬 타임존 기준) 의 YYYY-MM-DD 문자열.
 *
 * - new Date().toISOString() 의 UTC 함정 회피
 * - HTML <input type="date"> 의 value / max / min 에 직접 사용 가능
 * - 문자열 사전순 비교 = 날짜 비교 (시간대 무관 안전)
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 임의의 날짜/타임스탬프 문자열 → 사용자 로컬 타임존 기준 YYYY-MM-DD.
 *
 * ⚠️ measured_at 이 timestamptz(시각 포함) 일 때 `.split('T')[0]` 로 자르면
 * UTC 날짜라 KST 새벽 입력이 "어제"로 버킷팅됨. 이 함수는 new Date 로 파싱 후
 * 로컬 캘린더 날짜를 뽑아 그 버그를 피함. (순수 date 문자열도 안전하게 동작)
 */
export function localDateKey(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.split('T')[0];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
