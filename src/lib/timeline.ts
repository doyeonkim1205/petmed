import { localDateKey } from '@/lib/date';
import { formatMoney } from '@/lib/region';
import { conditionLabel, isAbnormalCondition } from '@/lib/excretion';
import { categoryMeta, categoryLabel } from '@/lib/preventiveCare';
import type { ExcretionKind, PreventiveCategory } from '@/lib/supabase';

// 타임라인 이벤트 종류
export type TLKind =
  | 'hospitalization' | 'symptom' | 'visit' | 'daily'
  | 'preventive' | 'med' | 'poop' | 'pee'
  | 'food' | 'water' | 'fluid' | 'respiratory' | 'weight' | 'cost';

// 라벨은 messages(timeline.label.*)로 분리 — buildTimeline 이 t 로 조합.

// 접힘 상태에서 '제목'으로 보여줄 중요 이벤트 + 우선순위(작을수록 먼저)
const TITLED_PRIORITY: Partial<Record<TLKind, number>> = {
  hospitalization: 0, symptom: 1, visit: 2, preventive: 3,
};

// 상세 정렬 — 같은 시각(특히 무시각 00:00)일 때 중요도순 tie-break (작을수록 위).
// 진료 > 입퇴원 > 증상 > 일상 > 예방 > 약(무시각) > 체중 > 지출.
const DETAIL_RANK: Record<TLKind, number> = {
  visit: 0, hospitalization: 1, symptom: 2, daily: 3, preventive: 4, med: 5, weight: 6, cost: 7,
  poop: 5, pee: 5, food: 5, water: 5, fluid: 5, respiratory: 5,
};

export interface TLEvent {
  id: string;
  kind: TLKind;
  timeMs: number;   // 정렬용
  time: string;     // 표시용 "HH:MM" (없으면 '')
  text: string;     // 구체 내용 (제목/상태/값)
  abnormal?: boolean;
  href?: string;    // 탭하면 이동할 원본
}

export interface TLChip { key: string; label: string; abnormal?: boolean; }

export interface TLDay {
  date: string;        // YYYY-MM-DD
  titled: TLEvent[];   // 중요 이벤트 (우선순위순)
  chips: TLChip[];     // 요약 칩
  events: TLEvent[];   // 그날 전부 (시각 오름차순) — 펼침 상세
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

// next-intl 의 t 를 느슨한 함수 타입으로 받아 lib 에서 ICU 조합 (어순/복수형은 messages 가 처리).
type TFn = (key: string, values?: Record<string, string | number>) => string;

// 각 소스 raw 배열을 받아 날짜별 TLDay[] 로 집계 (날짜 내림차순)
export function buildTimeline(t: TFn, input: {
  records: Array<{ id: string; record_type: string; title: string; visit_date: string }>;
  medMeta: Map<string, { name: string; alarm_times: string[] | null }>;
  checks: Array<{ id: string; medication_id: string; check_date: string; checked: boolean; checked_at?: string; dose_number?: number }>;
  preventives: Array<{ id: string; category: string; name: string; last_done_date: string }>;
  excretions: Array<{ id: string; kind: string; condition: string; measured_at: string }>;
  metrics: Array<{ id: string; metric_type: string; value: number; unit: string; input_pct?: number | null; measured_at: string }>;
  weights: Array<{ id: string; weight: number; measured_at: string }>;
  expenses: Array<{ id: string; amount: number; reason: string; spent_at: string }>;
}): TLDay[] {
  type Agg = {
    events: TLEvent[];
    med: number;
    poop: { n: number; abn: boolean };
    pee: { n: number; abn: boolean };
    food: { sum: number; pcts: number[]; unit: string };
    water: { sum: number; unit: string };
    fluid: { sum: number; pcts: number[]; unit: string };
    respiratory: { last: number; unit: string; n: number };
    weight: number | null;
    cost: number;
    daily: number;
  };
  const map = new Map<string, Agg>();
  const get = (dateKey: string): Agg => {
    let a = map.get(dateKey);
    if (!a) {
      a = { events: [], med: 0, poop: { n: 0, abn: false }, pee: { n: 0, abn: false },
        food: { sum: 0, pcts: [], unit: 'g' }, water: { sum: 0, unit: 'ml' }, fluid: { sum: 0, pcts: [], unit: 'ml' },
        respiratory: { last: 0, unit: '회/분', n: 0 },
        weight: null, cost: 0, daily: 0 };
      map.set(dateKey, a);
    }
    return a;
  };
  const startOfDayMs = (dateKey: string) => new Date(`${dateKey}T00:00:00`).getTime();

  // 1) 기록 (진료/증상/입퇴원/일상)
  for (const r of input.records) {
    const dk = localDateKey(r.visit_date);
    const a = get(dk);
    const kind = (['symptom', 'visit', 'hospitalization', 'daily'].includes(r.record_type) ? r.record_type : 'visit') as TLKind;
    if (kind === 'daily') a.daily += 1;
    a.events.push({ id: `rec-${r.id}`, kind, timeMs: startOfDayMs(dk), time: '', text: r.title || t(`timeline.label.${kind}`), href: `/records/${r.id}` });
  }

  // 2) 예방 (마지막 시행일)
  for (const p of input.preventives) {
    if (!p.last_done_date) continue;
    const dk = localDateKey(p.last_done_date);
    const a = get(dk);
    const meta = categoryMeta(p.category as PreventiveCategory);
    // 표시는 locale-aware, 비교는 저장 데이터(meta.label=한국어) 기준 — 사용자 커스텀명 여부 판별.
    const label = categoryLabel(p.category as PreventiveCategory, t);
    const text = p.name && p.name !== meta.label ? `${label} (${p.name})` : label;
    a.events.push({ id: `prev-${p.id}`, kind: 'preventive', timeMs: startOfDayMs(dk), time: '', text, href: '/records/preventive' });
  }

  // 3) 복약 체크 (완료된 것). 시각: 알림 설정된 약은 '예정 복용 시각'(alarm_times[dose]),
  //    없으면 체크한 시각(checked_at) 으로 fallback.
  for (const c of input.checks) {
    if (!c.checked) continue;
    const dk = c.check_date;
    const a = get(dk);
    a.med += 1;
    const med = input.medMeta.get(c.medication_id);
    const name = med?.name || t('timeline.medFallbackName');
    const scheduled = med?.alarm_times && med.alarm_times[c.dose_number ?? 0]; // "HH:MM"
    let timeMs: number;
    let time: string;
    if (scheduled) {
      time = scheduled;
      timeMs = new Date(`${dk}T${scheduled}:00`).getTime();
    } else {
      // 알림 off / free 계정 → 예정 시각 없음 → 무시각(중요도 순서로 정렬)
      time = '';
      timeMs = startOfDayMs(dk);
    }
    a.events.push({ id: `chk-${c.id}`, kind: 'med', timeMs, time, text: t('timeline.medDose', { name }), href: '/records/meds' });
  }

  // 4) 대소변
  for (const e of input.excretions) {
    const dk = localDateKey(e.measured_at);
    const a = get(dk);
    const k = (e.kind === 'pee' ? 'pee' : 'poop') as TLKind;
    const abn = isAbnormalCondition(e.kind as ExcretionKind, e.condition);
    if (k === 'poop') { a.poop.n += 1; a.poop.abn = a.poop.abn || abn; }
    else { a.pee.n += 1; a.pee.abn = a.pee.abn || abn; }
    a.events.push({ id: `exc-${e.id}`, kind: k, timeMs: new Date(e.measured_at).getTime(), time: hhmm(e.measured_at), text: conditionLabel(e.kind as ExcretionKind, e.condition, t), abnormal: abn, href: '/records/stats?tab=excretion' });
  }

  // 5) 지표 (음수/식사/수액/호흡수)
  for (const m of input.metrics) {
    const dk = localDateKey(m.measured_at);
    const a = get(dk);
    // 호흡수는 합산 X — 개별 측정값. 이벤트로만 표시 + 칩은 그날 마지막 값.
    if (m.metric_type === 'respiratory') {
      a.respiratory.last = Number(m.value); a.respiratory.unit = m.unit; a.respiratory.n += 1;
      a.events.push({ id: `met-${m.id}`, kind: 'respiratory', timeMs: new Date(m.measured_at).getTime(), time: hhmm(m.measured_at), text: `${Number(m.value)}${m.unit}`, href: '/records/stats?tab=respiratory' });
      continue;
    }
    const kind = (m.metric_type === 'water' ? 'water' : m.metric_type === 'food' ? 'food' : 'fluid') as TLKind;
    if (kind === 'food') { a.food.sum += Number(m.value); a.food.unit = m.unit; if (m.input_pct != null) a.food.pcts.push(m.input_pct); }
    else if (kind === 'water') { a.water.sum += Number(m.value); a.water.unit = m.unit; }
    else { a.fluid.sum += Number(m.value); a.fluid.unit = m.unit; if (m.input_pct != null) a.fluid.pcts.push(m.input_pct); }
    const valText = m.input_pct != null ? `${m.input_pct}% (${Number(m.value)}${m.unit})` : `${Number(m.value)}${m.unit}`;
    a.events.push({ id: `met-${m.id}`, kind, timeMs: new Date(m.measured_at).getTime(), time: hhmm(m.measured_at), text: valText, href: `/records/stats?tab=${m.metric_type}` });
  }

  // 6) 체중 (그날 마지막값)
  for (const w of input.weights) {
    const dk = localDateKey(w.measured_at);
    const a = get(dk);
    a.weight = Number(w.weight);
    a.events.push({ id: `wt-${w.id}`, kind: 'weight', timeMs: startOfDayMs(dk), time: '', text: `${Number(w.weight)}kg`, href: '/records/stats?tab=weight' });
  }

  // 7) 의료비
  for (const x of input.expenses) {
    const dk = localDateKey(x.spent_at);
    const a = get(dk);
    a.cost += Number(x.amount);
    a.events.push({ id: `exp-${x.id}`, kind: 'cost', timeMs: startOfDayMs(dk), time: '', text: formatMoney(Number(x.amount), 'KRW') + (x.reason ? ` · ${x.reason}` : ''), href: '/records/expenses' });
  }

  // TLDay[] 빌드
  const days: TLDay[] = [];
  for (const [date, a] of map) {
    const titled = a.events
      .filter((e) => e.kind in TITLED_PRIORITY)
      .sort((x, y) => (TITLED_PRIORITY[x.kind]! - TITLED_PRIORITY[y.kind]!) || x.timeMs - y.timeMs);

    const chips: TLChip[] = [];
    if (a.med > 0) chips.push({ key: 'med', label: t('timeline.chip.med', { count: a.med }) });
    if (a.poop.n > 0) chips.push({ key: 'poop', label: t('timeline.chip.poop', { count: a.poop.n }), abnormal: a.poop.abn });
    if (a.pee.n > 0) chips.push({ key: 'pee', label: t('timeline.chip.pee', { count: a.pee.n }), abnormal: a.pee.abn });
    if (a.food.sum > 0 || a.food.pcts.length > 0) {
      const avg = a.food.pcts.length ? Math.round(a.food.pcts.reduce((s, v) => s + v, 0) / a.food.pcts.length) : null;
      chips.push({ key: 'food', label: avg != null ? t('timeline.chip.foodPct', { pct: avg }) : t('timeline.chip.foodAmount', { amount: Math.round(a.food.sum), unit: a.food.unit }) });
    }
    if (a.water.sum > 0) chips.push({ key: 'water', label: t('timeline.chip.water', { amount: Math.round(a.water.sum), unit: a.water.unit }) });
    if (a.fluid.sum > 0) chips.push({ key: 'fluid', label: t('timeline.chip.fluid', { amount: Math.round(a.fluid.sum), unit: a.fluid.unit }) });
    if (a.respiratory.n > 0) chips.push({ key: 'respiratory', label: t('timeline.chip.respiratory', { amount: a.respiratory.last, unit: a.respiratory.unit }) });
    if (a.weight != null) chips.push({ key: 'weight', label: `${a.weight}kg` });
    if (a.daily > 0) chips.push({ key: 'daily', label: t('timeline.chip.daily', { count: a.daily }) });
    if (a.cost > 0) chips.push({ key: 'cost', label: formatMoney(a.cost, 'KRW') });

    // 시각 오름차순 → 같은 시각(무시각 00:00)은 중요도순(DETAIL_RANK)
    const events = [...a.events].sort((x, y) => (x.timeMs - y.timeMs) || (DETAIL_RANK[x.kind] - DETAIL_RANK[y.kind]));
    days.push({ date, titled, chips, events });
  }
  days.sort((x, y) => y.date.localeCompare(x.date)); // 최신 날짜 먼저
  return days;
}
