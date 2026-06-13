import type { PreventiveCategory } from '@/lib/supabase';

// 예방 관리 카테고리 메타 — 라벨/아이콘/기본 주기/제품 제안.
// 기본 주기는 "추가 폼"에서 카테고리 선택 시 자동으로 채워주는 값.
export interface CategoryMeta {
  id: PreventiveCategory;
  label: string;
  emoji: string;
  defaultUnit: 'month' | 'year';
  defaultValue: number;
  products: string[];
}

export const PREVENTIVE_CATEGORIES: CategoryMeta[] = [
  { id: 'heartworm',         label: '심장사상충',   emoji: '🦟', defaultUnit: 'month', defaultValue: 1, products: ['하트가드 플러스', '넥스가드 스펙트라', '애드보킷', '레볼루션', '프로하트(주사)'] },
  { id: 'external_parasite', label: '외부기생충',   emoji: '🛡️', defaultUnit: 'month', defaultValue: 1, products: ['넥스가드', '프론트라인', '브라벡토', '세레스토(목걸이)', '레볼루션'] },
  { id: 'internal_worm',     label: '내부구충',     emoji: '🪱', defaultUnit: 'month', defaultValue: 3, products: ['드론탈', '파나쿠어', '버박'] },
  { id: 'vaccine',           label: '종합백신',     emoji: '💉', defaultUnit: 'year',  defaultValue: 1, products: ['DHPPL(강아지)', 'FVRCP(고양이)', '켄넬코프', '인플루엔자', '백혈병(FeLV)'] },
  { id: 'rabies',            label: '광견병',       emoji: '🩹', defaultUnit: 'year',  defaultValue: 1, products: [] },
  { id: 'health_check',      label: '건강검진',     emoji: '🩺', defaultUnit: 'year',  defaultValue: 1, products: ['종합검진', '혈액검사', '심장검사'] },
  { id: 'other',             label: '기타',         emoji: '➕', defaultUnit: 'month', defaultValue: 1, products: [] },
];

export function categoryMeta(id: PreventiveCategory): CategoryMeta {
  return PREVENTIVE_CATEGORIES.find((c) => c.id === id) || PREVENTIVE_CATEGORIES[PREVENTIVE_CATEGORIES.length - 1];
}

// 주기 라벨 (예: "월 1회", "3개월", "연 1회")
export function intervalLabel(unit: 'month' | 'year', value: number): string {
  if (unit === 'year') return value === 1 ? '연 1회' : `${value}년`;
  return value === 1 ? '월 1회' : `${value}개월`;
}

// 로컬 기준 오늘 (YYYY-MM-DD)
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 날짜(YYYY-MM-DD)에 주기를 더한 다음 예정일 계산. 월말 오버플로는 해당 월 말일로 클램프.
export function addInterval(dateISO: string, unit: 'month' | 'year', value: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  let ty = y, tm = m; // 1-based month
  if (unit === 'year') ty = y + value;
  else {
    const total = (m - 1) + value;
    ty = y + Math.floor(total / 12);
    tm = (total % 12) + 1;
  }
  // 대상 월의 말일로 day 클램프 (예: 1/31 + 1개월 → 2/28)
  const lastDay = new Date(ty, tm, 0).getDate();
  const td = Math.min(d, lastDay);
  return `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

// 오늘 대비 D-day (양수=남음, 0=당일, 음수=지남)
export function ddayFrom(nextDueISO: string, baseISO: string = todayISO()): number {
  const a = new Date(baseISO + 'T00:00:00');
  const b = new Date(nextDueISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type CareStatus = 'overdue' | 'soon' | 'ok';

// D-7 이내 임박, 지난 건 overdue.
export function careStatus(nextDueISO: string, baseISO: string = todayISO()): CareStatus {
  const dd = ddayFrom(nextDueISO, baseISO);
  if (dd < 0) return 'overdue';
  if (dd <= 7) return 'soon';
  return 'ok';
}

// D-day 표시 문구 (예: "D-3", "오늘", "3일 지남")
export function ddayLabel(nextDueISO: string, baseISO: string = todayISO()): string {
  const dd = ddayFrom(nextDueISO, baseISO);
  if (dd === 0) return '오늘';
  if (dd > 0) return `D-${dd}`;
  return `${-dd}일 지남`;
}
