/**
 * 홈 "건강 브리핑" 카드 유틸 — 나이 계산, 생일 판정, 동적 강조 선정.
 *
 * 외부 의존성 없는 순수 함수만 모음 (테스트 용이성).
 */

export interface PetAge {
  years: number;   // 만 나이
  months: number;  // 만 1살 미만 시 개월수
  days: number;    // 1개월 미만 시 일수
}

/**
 * birth_date (YYYY-MM-DD) 로 만 나이 계산.
 * - 미래 날짜면 null (입력 실수 방어).
 * - 만 1살 이상: years 만 의미 있음
 * - 만 1살 미만: months 사용
 * - 1개월 미만: days 사용
 */
export function calculateAge(birthDate: string | undefined | null): PetAge | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  // 시각 정보 제거 — 자정 기준 비교
  birth.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  if (birth > now) return null;  // 미래 날짜

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    // 이전 달의 마지막 일수 더하기
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
 * - 미래 날짜 / 잘못된 입력 → false
 */
export function isBirthdayToday(birthDate: string | undefined | null): boolean {
  if (!birthDate) return false;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return false;
  const today = new Date();
  // 둘 다 자정 기준
  birth.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
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
 * 동적 강조 우선순위 — 가장 의미 있는 알림 1개만 카드 상단 강조.
 *
 * 우선순위:
 *   1. 생일 당일 (rose)
 *   2. 다음 예약 D-7 이내 (amber)
 *   3. 마지막 기록 7일 초과 (blue)
 *   4. 없음 (강조 박스 안 보임 → 메트릭만)
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
  if (opts.daysUntilAppointment !== null && opts.daysUntilAppointment <= 7) {
    return { type: 'appointment', daysUntilAppointment: opts.daysUntilAppointment };
  }
  if (opts.daysSinceLastRecord !== null && opts.daysSinceLastRecord >= 7) {
    return { type: 'inactive', daysSinceLastRecord: opts.daysSinceLastRecord };
  }
  return { type: null };
}
