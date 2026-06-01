/**
 * 홈 "건강 브리핑" 카드 유틸 — 나이 계산, 생일 판정, 동적 강조 선정.
 *
 * 외부 의존성 없는 순수 함수만 모음 (테스트 용이성).
 *
 * ⚠️ 시간대 안전: 모든 birth_date (YYYY-MM-DD) 파싱은 parseLocalDate 사용.
 *   new Date("YYYY-MM-DD") 는 UTC 자정으로 해석되어 한국 시간 새벽에 하루 어긋남.
 *   parseLocalDate 는 로컬 자정으로 파싱 → 사용자 시계 기준으로 일치.
 */

export interface PetAge {
  years: number;   // 만 나이
  months: number;  // 만 1살 미만 시 개월수
  days: number;    // 1개월 미만 시 일수
}

/**
 * "YYYY-MM-DD" 문자열을 로컬 타임존 자정 Date 로 파싱.
 * - 한국 시간 새벽 등 모든 시각에서 사용자 캘린더 날짜와 일치
 * - 형식 잘못되면 null
 */
function parseLocalDate(yyyymmdd: string): Date | null {
  if (!yyyymmdd) return null;
  // "2026-06-01" 또는 "2026-06-01T..." 형태 → 앞 10자만 사용
  const parts = yyyymmdd.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);  // 로컬 자정
}

/** 오늘의 로컬 자정 Date. */
function localToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * birth_date (YYYY-MM-DD) 로 만 나이 계산.
 * - 오늘 포함 과거 날짜: 정상 계산 (오늘 태어남 → 0살 0개월 0일)
 * - 미래 날짜: null (입력 실수 방어)
 */
export function calculateAge(birthDate: string | undefined | null): PetAge | null {
  if (!birthDate) return null;
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const now = localToday();
  if (birth > now) return null;  // 미래 날짜만 차단 (오늘 포함은 허용)

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
}

/**
 * 나이 표시 문자열.
 *   만 1살 이상 → "5살"
 *   만 1살 미만 → "8개월"
 *   1개월 미만 → "10일"
 *   null → ''
 */
export function formatAge(age: PetAge | null): string {
  if (!age) return '';
  if (age.years >= 1) return `${age.years}살`;
  if (age.months >= 1) return `${age.months}개월`;
  return `${Math.max(age.days, 0)}일`;
}

/**
 * 오늘이 펫의 생일인지 판정.
 * - birth_date 의 월/일 == 오늘의 월/일
 * - 윤년 2/29 출생: 평년에는 3/1 을 생일로 인정 (한국 통상)
 * - 오늘 태어남도 생일로 인정 (방금 등록한 펫)
 * - 미래 날짜 / 잘못된 입력 → false
 */
export function isBirthdayToday(birthDate: string | undefined | null): boolean {
  if (!birthDate) return false;
  const birth = parseLocalDate(birthDate);
  if (!birth) return false;
  const today = localToday();
  if (birth > today) return false;

  const bMonth = birth.getMonth();
  const bDate = birth.getDate();

  // 윤년 2/29 출생 + 올해는 평년 → 3/1 을 생일로
  if (bMonth === 1 && bDate === 29) {
    const year = today.getFullYear();
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (!isLeap) {
      return today.getMonth() === 2 && today.getDate() === 1;
    }
  }

  return today.getMonth() === bMonth && today.getDate() === bDate;
}

/**
 * 두 YYYY-MM-DD 날짜의 일수 차이 (date2 - date1). 시각 무관.
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

/**
 * 동적 강조 우선순위 — 가장 의미 있는 알림 1개만 텍스트 색/볼드로 강조.
 *
 * 우선순위:
 *   1. 생일 당일 → 헤더에 별도 두 번째 줄로 표시 (rose)
 *   2. 다음 예약 D-3 이내 → "다음 예약" 메트릭 행 색/볼드 (amber)
 *   3. 마지막 기록 7일 초과 → "마지막 기록" 메트릭 행 색/볼드 (blue)
 *   4. 없음 → 메트릭 2행 회색 (평소)
 */
export type HighlightType = 'birthday' | 'appointment' | 'inactive' | null;

export interface Highlight {
  type: HighlightType;
  daysUntilAppointment?: number;
  daysSinceLastRecord?: number;
}

export function pickHighlight(opts: {
  isBirthday: boolean;
  daysUntilAppointment: number | null;
  daysSinceLastRecord: number | null;
}): Highlight {
  if (opts.isBirthday) return { type: 'birthday' };
  if (opts.daysUntilAppointment !== null && opts.daysUntilAppointment <= 3) {
    return { type: 'appointment', daysUntilAppointment: opts.daysUntilAppointment };
  }
  if (opts.daysSinceLastRecord !== null && opts.daysSinceLastRecord >= 7) {
    return { type: 'inactive', daysSinceLastRecord: opts.daysSinceLastRecord };
  }
  return { type: null };
}
