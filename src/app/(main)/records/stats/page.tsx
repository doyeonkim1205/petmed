'use client';

import { useState, useEffect, useMemo, useCallback, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Lock, Scale, Plus, ArrowUpRight, ArrowDownRight, Minus, Droplet, Utensils, Syringe, SlidersHorizontal, CircleDot, ChevronUp, ChevronDown, StickyNote, X, Wind } from 'lucide-react';
import { MetricTracker } from '@/components/records/MetricTracker';
import { ExcretionTracker } from '@/components/records/ExcretionTracker';
import { RespiratoryTracker } from '@/components/records/RespiratoryTracker';
import type { MetricType } from '@/lib/healthMetrics';
import { getEnabledStatsTabs, setEnabledStatsTabs, ALL_METRIC_TABS, STATS_TAB_LABELS, type MetricTabId } from '@/lib/statsTabPrefs';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { supabase, Pet, WeightLog } from '@/lib/supabase';
import { syncPetWeightCache } from '@/lib/petWeight';
import { todayLocalISO } from '@/lib/date';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { OnboardHint } from '@/components/ui/OnboardHint';
import { NumberPad } from '@/components/ui/NumberPad';

type StatsTab = 'weight' | 'water' | 'food' | 'fluid' | 'excretion' | 'respiratory';
const METRIC_TABS: MetricType[] = ['water', 'food', 'fluid'];
// 탭 아이콘 (라벨은 STATS_TAB_LABELS). 탭 바·설정은 enabledTabs(사용자 순서)를 그대로 렌더.
const TAB_ICON: Record<MetricTabId, ComponentType<{ size?: number; className?: string }>> = {
  weight: Scale, water: Droplet, food: Utensils, fluid: Syringe, excretion: CircleDot, respiratory: Wind,
};
type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

// 라벨은 messages(stats.period.* === expenses.period.* 동일)로 분리 — id 로 t() 참조.
const allPeriodOptions: { id: Period; months: number }[] = [
  { id: 'month', months: 1 },
  { id: '3month', months: 3 },
  { id: 'year', months: 12 },
  // "전체" 와 "직접 선택" 은 큰 값 (200 개월 = 16년+) 으로 Free(3) 에선 자물쇠,
  // Plus(999) 에선 사용 가능하게 분류.
  { id: 'all', months: 200 },
  { id: 'custom', months: 200 },
];

function getStartDate(period: Period, customStart?: string): Date {
  const now = new Date();
  switch (period) {
    // 1개월: 일별 데이터 보는 게 의미 → 날짜 기반 (오늘 - 30일).
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0); return d; }
    // 3개월/1년: 월별 합계 보는 게 의미 → 캘린더 월 기반.
    //   3개월 = 최근 3개 캘린더 월 (예: 오늘 6/4 → 4/1 ~ 6/4 = 4, 5, 6월 3개월)
    case '3month': return new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    //   1년 = 최근 12개 캘린더 월 (예: 오늘 6/4 → 2025/7/1 ~ 2026/6/4 = 12개월)
    case 'year': return new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    case 'all': return new Date(2000, 0, 1);  // 사실상 모든 기록 포함 (PawDex 출시 2026)
    case 'custom': return customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function getEndDate(period: Period, customEnd?: string): Date {
  if (period === 'custom' && customEnd) { const d = new Date(customEnd); d.setHours(23, 59, 59, 999); return d; }
  // "오늘 끝"으로 — 페이지 렌더 시각(now)에 고정되면 그 이후 추가한 기록이 차트 범위 밖으로
  //   걸러져 즉시 반영 안 되던 문제 방지. 같은 날 기록은 시각 상관없이 포함.
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}


// Sample data for chart: 1month=all, 3month=7day interval, year+=monthly
function sampleForChart(data: { date: string; weight: number }[], period: Period): { date: string; weight: number }[] {
  if (data.length <= 30) return data;
  if (period === 'month') return data;

  if (period === '3month') {
    // 7-day interval: keep last value per 7-day bucket
    const result: { date: string; weight: number }[] = [];
    let lastBucket = '';
    for (const item of data) {
      const d = new Date(item.date);
      const weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
      const bucket = String(weekNum);
      if (bucket !== lastBucket) {
        result.push(item);
        lastBucket = bucket;
      } else {
        result[result.length - 1] = item; // keep latest in bucket
      }
    }
    return result;
  }

  // year or custom: monthly last value
  const result: { date: string; weight: number }[] = [];
  let lastMonth = '';
  for (const item of data) {
    const month = item.date.substring(0, 7); // YYYY-MM
    if (month !== lastMonth) {
      result.push(item);
      lastMonth = month;
    } else {
      result[result.length - 1] = item;
    }
  }
  return result;
}

// ─── Weight Chart (SVG line chart) ──────────────────────
function WeightChart({ data }: { data: { date: string; weight: number }[] }) {
  if (data.length < 2) return null;
  const W = 320, H = 160, PX = 40, PY = 20;
  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 0.5;
  const chartW = W - PX * 2;
  const chartH = H - PY * 2;

  const points = data.map((d, i) => ({
    x: PX + (i / (data.length - 1)) * chartW,
    y: PY + chartH - ((d.weight - minW) / range) * chartH,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  // Show ~5 date labels evenly spaced
  const labelCount = Math.min(5, data.length);
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round(i * (data.length - 1) / (labelCount - 1))
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '180px' }}>
      {[0, 0.5, 1].map((r) => {
        const y = PY + chartH - r * chartH;
        const val = (minW + r * range).toFixed(1);
        return (
          <g key={r}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PX - 11} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{val}</text>
          </g>
        );
      })}
      <polyline points={polyline} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={data.length > 20 ? 2 : 4} fill="#3B82F6" stroke="#fff" strokeWidth={data.length > 20 ? 1 : 2} />
      ))}
      {labelIndices.map((idx) => (
        <text key={idx} x={points[idx].x} y={H - 2} textAnchor="middle" fontSize="9" fill="#9ca3af">
          {new Date(data[idx].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

export default function StatsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, profile } = useAuth();
  const planConfig = getPlanConfig(getEffectivePlan(profile?.plan));
  const maxMonths = planConfig.costStatsMonths;

  const [tab, setTab] = useState<StatsTab>('weight');
  // "표시 지표" 토글 — 켜진 탭만 노출. 헤더 설정(⚙)에서 켜고 끔. 마운트 후 localStorage 에서 읽음.
  const [enabledTabs, setEnabledTabs] = useState<MetricTabId[]>(['weight', 'water', 'food', 'fluid']);
  const [showTabSettings, setShowTabSettings] = useState(false);

  const toggleStatTab = (id: MetricTabId) => {
    setEnabledTabs((prev) => {
      const removing = prev.includes(id);
      // 최소 1개는 항상 켜져 있어야 함 — 마지막 1개는 해제 불가.
      if (removing && prev.length === 1) return prev;
      // 켤 땐 맨 뒤에 추가(순서 유지), 끌 땐 제거.
      const next = removing ? prev.filter((t) => t !== id) : [...prev, id];
      setEnabledStatsTabs(next);
      if (next.length > 0 && !next.includes(tab as MetricTabId)) setTab(next[0]);
      return next;
    });
  };

  // 켜진 지표 순서 변경 (위/아래)
  const moveTab = (id: MetricTabId, dir: 'up' | 'down') => {
    setEnabledTabs((prev) => {
      const i = prev.indexOf(id);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      setEnabledStatsTabs(next);
      return next;
    });
  };
  // 정적 프리렌더 컴포넌트에선 useState lazy initializer 의 URL 접근이 빌드 시점 서버 값으로
  // 굳어 클라이언트 쿼리를 못 읽음 → 마운트 후 useEffect 로 ?tab=weight 직통 처리.
  useEffect(() => {
    const enabled = getEnabledStatsTabs();
    setEnabledTabs(enabled);
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'cost') { router.replace('/records/expenses'); return; }
    if (t && (['weight', 'water', 'food', 'fluid', 'excretion'] as string[]).includes(t)) {
      setTab(t as StatsTab);
    } else if (enabled.length > 0) {
      setTab(enabled[0]); // 첫 켜진 지표로 시작
    }
  }, []);
  const periodOptions = allPeriodOptions.filter(p => p.months <= maxMonths);
  const lockedOptions = allPeriodOptions.filter(p => p.months > maxMonths);

  // 건강 지표·체중은 일별 추적이라 기본은 '1개월(일별)' — 월별 버킷('6.1.' 라벨) 혼동 방지.
  const defaultPeriod: Period = 'month';
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);

  // Weight states
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightLoading, setWeightLoading] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newWeightMemo, setNewWeightMemo] = useState('');
  const [newWeightDate, setNewWeightDate] = useState(todayLocalISO());
  // Chrome autofill 차단 readonly trick.
  const [newWeightFocused, setNewWeightFocused] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  // 터치 기기에선 OS 키보드 대신 내장 숫자 패드 사용 (크롬 autofill 칩 차단)
  const [isTouch, setIsTouch] = useState(false);
  const [showWeightPad, setShowWeightPad] = useState(false);

  // 건강통계 조회 추적 — 기기당 하루 1회만 (노이즈 방지, 참여도 파악용)
  useEffect(() => {
    if (!user) return;
    import('@/lib/trackEvent').then(({ trackPageViewDaily }) => trackPageViewDaily('page.stats'));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const defaultId = readDefaultPetId();
          const sorted = sortPetsWithDefault(data, defaultId);
          setPets(sorted);
          // 건강 통계는 '전체'가 없어 항상 한 마리 선택 — 기본 펫 우선, 없으면 첫 펫.
          if (sorted.length >= 1) {
            const def = defaultId && sorted.some(p => p.id === defaultId) ? defaultId : sorted[0].id;
            setSelectedPetId(def);
          }
        }
        // 펫 로딩 + selectedPetId 결정 완료 표시 — 이 전엔 통계 스켈레톤 유지(빈 값 깜빡임 방지)
        setPetsLoaded(true);
      });
  }, [user]);

  // 터치(모바일) 기기 감지 — 숫자 패드 사용 여부 결정
  useEffect(() => {
    setIsTouch(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const { records } = useHealthRecords(selectedPetId);
  const startDate = getStartDate(period, customStart);
  const endDate = getEndDate(period, customEnd);


  // ─── Weight data ──────────────────────
  const fetchWeightLogs = useCallback(async () => {
    if (!user) return;
    setWeightLoading(true);
    let query = supabase.from('weight_logs').select('*').eq('user_id', user.id).order('measured_at', { ascending: true }).order('created_at', { ascending: true });
    if (selectedPetId) query = query.eq('pet_id', selectedPetId);
    const { data } = await query;
    setWeightLogs(data || []);
    setWeightLoading(false);
  }, [user, selectedPetId]);

  useEffect(() => {
    if (tab === 'weight') fetchWeightLogs();
  }, [tab, fetchWeightLogs]);

  // Merge weight_logs + health_records weight, filter by period.
  // allWeightData 와 같은 포맷/tie-breaker 규칙 적용 (버그 설명은 아래 주석 참고).
  const weightData = useMemo(() => {
    const items: { date: string; weight: number; source: 'log' | 'record'; id: string; createdAt: string; petName?: string; recordType?: string; memo?: string | null }[] = [];

    for (const log of weightLogs) {
      const d = new Date(String(log.measured_at).split('T')[0] + 'T00:00:00'); // 로컬 자정 (UTC 파싱 함정 회피)
      if (d >= startDate && d <= endDate) {
        items.push({
          date: String(log.measured_at).split('T')[0],
          weight: Number(log.weight),
          source: 'log',
          id: log.id,
          createdAt: (log as { created_at?: string }).created_at || '',
          petName: pets.find(p => p.id === log.pet_id)?.name,
          memo: (log as { memo?: string | null }).memo ?? null,
        });
      }
    }

    for (const r of records) {
      if (r.weight && r.weight > 0) {
        if (!selectedPetId || r.pet_id === selectedPetId) {
          const d = new Date(r.visit_date.split('T')[0] + 'T00:00:00'); // 로컬 자정
          if (d >= startDate && d <= endDate) {
            items.push({
              date: r.visit_date.split('T')[0],
              weight: r.weight,
              source: 'record',
              id: r.id,
              createdAt: (r as { created_at?: string }).created_at || '',
              petName: r.pets?.name,
              recordType: r.record_type,
            });
          }
        }
      }
    }

    items.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.createdAt.localeCompare(b.createdAt);
    });
    return items;
  }, [weightLogs, records, selectedPetId, pets, startDate, endDate]);

  // All weight data (no period filter) for latest/prev calculation.
  //
  // 버그 2건 수정:
  //   (1) 날짜 포맷 불일치: weight_logs.measured_at 은 ISO 타임스탬프
  //       ("2025-04-22T00:00:00.000Z"), records.visit_date 는 .split('T')[0]
  //       로 잘라서 날짜만 ("2025-04-22"). 같은 날짜인데 문자열 비교에서
  //       record < log 가 되어 log 가 항상 뒤로 정렬됨 → 유저가 입력
  //       순서와 무관하게 log 가 "latest" 로 잡히던 문제. 양쪽 모두
  //       YYYY-MM-DD 로 통일.
  //   (2) 같은 날짜 tie-breaker 부재: 같은 날짜 여러 기록 있을 때 어떤 게
  //       "latest" 로 선택될지 불확실. items 에 created_at 도 같이 저장해서
  //       정렬 2차 키로 사용 → "마지막 날짜 + 그 날짜의 마지막 입력" 이
  //       정확히 맨 뒤로 옴.
  const allWeightData = useMemo(() => {
    const items: { date: string; weight: number; createdAt: string }[] = [];
    for (const log of weightLogs) {
      items.push({
        date: String(log.measured_at).split('T')[0],
        weight: Number(log.weight),
        createdAt: (log as { created_at?: string }).created_at || '',
      });
    }
    for (const r of records) {
      if (r.weight && r.weight > 0 && (!selectedPetId || r.pet_id === selectedPetId)) {
        items.push({
          date: r.visit_date.split('T')[0],
          weight: r.weight,
          createdAt: (r as { created_at?: string }).created_at || '',
        });
      }
    }
    items.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      // 같은 날짜 → 입력 시각 오름차순. 맨 뒤 요소가 "가장 마지막 입력".
      return a.createdAt.localeCompare(b.createdAt);
    });
    return items;
  }, [weightLogs, records, selectedPetId]);

  const latestWeight = allWeightData.length > 0 ? allWeightData[allWeightData.length - 1] : null;
  const prevWeight = allWeightData.length > 1 ? allWeightData[allWeightData.length - 2] : null;
  const weightDiff = latestWeight && prevWeight ? +(latestWeight.weight - prevWeight.weight).toFixed(2) : null;

  const chartData = useMemo(() => sampleForChart(weightData, period), [weightData, period]);
  const weightMin = weightData.length > 0 ? Math.min(...weightData.map(d => d.weight)) : 0;
  const weightMax = weightData.length > 0 ? Math.max(...weightData.map(d => d.weight)) : 0;

  const handleAddWeight = async () => {
    if (!user || !newWeight || !selectedPetId) return;
    const w = Math.round(Math.min(Math.max(0.1, Number(newWeight)), 100) * 100) / 100;
    const today = todayLocalISO();
    const date = newWeightDate > today ? today : newWeightDate;
    setWeightSaving(true);
    await supabase.from('weight_logs').insert({ user_id: user.id, pet_id: selectedPetId, weight: w, measured_at: date, memo: newWeightMemo.trim() || null });
    await syncPetWeightCache(selectedPetId); // pets.weight 캐시 최신화
    setNewWeight('');
    setNewWeightMemo('');
    setShowWeightInput(false);
    setWeightSaving(false);
    fetchWeightLogs();
  };

  const handleDeleteWeight = async (id: string) => {
    await supabase.from('weight_logs').delete().eq('id', id);
    if (selectedPetId) await syncPetWeightCache(selectedPetId); // 최신 로그 삭제 시 캐시 재계산
    fetchWeightLogs();
  };

  const [selectedWeightId, setSelectedWeightId] = useState<string | null>(null);

  const needPetSelect = tab === 'weight' && !selectedPetId && pets.length > 1;
  const noPets = petsLoaded && pets.length === 0;

  // ─── Period selector (shared between tabs) ──────────────────────
  return (
    <div className="bg-white min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white relative">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">{t('record.module.stats')}</h1>
          <button onClick={() => setShowTabSettings((v) => !v)} className="absolute right-2 p-2 text-gray-400" aria-label={t('stats.tabSettingsLabel')}>
            <SlidersHorizontal size={16} />
          </button>
        </header>

        {/* 필터 안내 말풍선 — 필터 버튼 바로 아래 붙음 (첫 방문 1회) */}
        <div className="absolute right-2 top-[50px] z-20 w-64">
          <OnboardHint storageKey="hint_stats_filter_v2" pointer="right"
            text={t('stats.filterHint')} />
        </div>

        {/* 지표 편집 바텀시트 — 배경 락 + 큰 ↑↓ 순서 변경 + 표시 토글 */}
        {showTabSettings && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowTabSettings(false)}>
            <div className="relative w-full max-w-sm bg-white rounded-t-2xl p-4 pb-6 max-h-[82vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowTabSettings(false)} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600" aria-label={t('common.close')}><X size={20} /></button>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 text-center mb-1">{t('stats.editMetrics')}</h3>
              <p className="text-xs text-gray-400 text-center mb-4 break-keep break-words">{t('stats.editMetricsDesc')}</p>

              <p className="text-[11px] font-bold text-gray-400 mb-1">{t('stats.shown')}</p>
              {enabledTabs.map((id, i) => (
                <div key={id} className="flex items-center gap-2 py-2.5">
                  <span className="flex-1 text-sm font-medium text-gray-800">{t(`stats.tab.${id}`)}</span>
                  <button onClick={() => moveTab(id, 'up')} disabled={i <= 0}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:text-gray-200 disabled:border-gray-100" aria-label={t('stats.moveUp')}><ChevronUp size={18} /></button>
                  <button onClick={() => moveTab(id, 'down')} disabled={i >= enabledTabs.length - 1}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:text-gray-200 disabled:border-gray-100" aria-label={t('stats.moveDown')}><ChevronDown size={18} /></button>
                  <button onClick={() => toggleStatTab(id)} aria-label={t('stats.hideMetric')}
                    className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${enabledTabs.length === 1 ? 'bg-blue-300' : 'bg-blue-600'}`}>
                    <span className="absolute top-0.5 left-[18px] w-5 h-5 rounded-full bg-white transition-all" />
                  </button>
                </div>
              ))}

              {ALL_METRIC_TABS.filter((x) => !enabledTabs.includes(x)).length > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-200 my-3" />
                  <p className="text-[11px] font-bold text-gray-400 mb-1">{t('stats.hidden')}</p>
                  {ALL_METRIC_TABS.filter((x) => !enabledTabs.includes(x)).map((id) => (
                    <div key={id} className="flex items-center gap-2 py-2.5">
                      <span className="flex-1 text-sm font-medium text-gray-400">{t(`stats.tab.${id}`)}</span>
                      <button onClick={() => toggleStatTab(id)} aria-label={t('stats.showMetric')}
                        className="relative w-10 h-6 rounded-full flex-shrink-0 bg-gray-300 transition-colors">
                        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all" />
                      </button>
                    </div>
                  ))}
                </>
              )}

              <button onClick={() => setShowTabSettings(false)}
                className="w-full h-11 mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors">{t('common.done')}</button>
            </div>
          </div>
        )}
        {pets.length > 1 && (
          <div className={`flex gap-1.5 overflow-x-auto max-w-sm mx-auto px-4 pt-1 pb-2 ${pets.length <= 4 ? 'justify-center' : ''}`}>
            {pets.map((pet) => (
              <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {pet.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex max-w-sm mx-auto overflow-x-auto">
          {enabledTabs.map((id) => {
            const Icon = TAB_ICON[id];
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 min-w-[68px] flex items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>
                <Icon size={13} />{t(`stats.tab.${id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Period selector (chips) */}
        <div className="flex gap-1.5 overflow-x-auto">
          {periodOptions.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{t(`expenses.period.${p.id}`)}</button>
          ))}
          {lockedOptions.map((p) => (
            <button key={p.id} onClick={() => router.push('/profile/subscription')}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1">
              <Lock size={11} />{t(`expenses.period.${p.id}`)}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div>
            <div className="flex gap-2 items-center">
              <DatePicker value={customStart} onChange={setCustomStart}
                className="flex-1 min-w-0"
                inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
              <span className="text-gray-400 text-sm">~</span>
              <DatePicker value={customEnd} onChange={setCustomEnd}
                min={customStart}
                className="flex-1 min-w-0"
                inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{t('stats.customDateHint')}</p>
          </div>
        )}

        {enabledTabs.length === 0 && (
          <div className="rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400 break-keep break-words">
            {t('stats.noMetrics')}
          </div>
        )}

        {/* ═══ WEIGHT TAB ═══ */}
        {tab === 'weight' && enabledTabs.includes('weight') && (
          <>
            {(!petsLoaded || weightLoading) ? (
              <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : (noPets || needPetSelect) ? (
              <div className="text-center py-16">
                <Scale size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">{noPets ? t('common.registerPetFirst') : t('common.selectPet')}</p>
              </div>
            ) : (
              <>
                {/* Current weight summary */}
                {latestWeight ? (
                  <div className="rounded-xl bg-blue-50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-blue-400 font-medium">
                        {t('stats.petWeight', { name: pets.find(p => p.id === selectedPetId)?.name || t('stats.current') })}
                      </p>
                      <p className="text-xl font-bold text-gray-800">{latestWeight.weight}kg</p>
                    </div>
                    {weightDiff !== null && weightDiff !== 0 ? (
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        weightDiff > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {weightDiff > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {weightDiff > 0 ? '+' : ''}{weightDiff}kg
                      </div>
                    ) : weightDiff === 0 ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        <Minus size={12} /> {t('stats.noChange')}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 py-8 text-center">
                    <Scale size={32} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-sm text-gray-400">{t('stats.noWeightRecords')}</p>
                  </div>
                )}

                <OnboardHint storageKey="hint_stats_weight_record_v2" pointer="center"
                  text={t('stats.weightHint')} />

                {/* Chart */}
                {chartData.length >= 2 && (
                  <div className="rounded-xl border border-gray-100 p-4">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">{t('stats.weightChange')}</h2>
                    <WeightChart data={chartData} />
                    <div className="flex justify-center gap-6 mt-3">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">{t('stats.min')}</p>
                        <p className="text-sm font-bold text-blue-600">{weightMin}kg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">{t('stats.max')}</p>
                        <p className="text-sm font-bold text-red-500">{weightMax}kg</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weight input */}
                {showWeightInput ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                    <div className="flex gap-2">
                      <input type="text"
                        inputMode={isTouch ? 'none' : 'decimal'}
                        placeholder={t('record.form.weightKg')} value={newWeight}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setNewWeight(v);
                        }}
                        readOnly={isTouch ? true : !newWeightFocused}
                        onFocus={() => setNewWeightFocused(true)}
                        onBlur={() => setNewWeightFocused(false)}
                        onClick={() => { if (isTouch) setShowWeightPad(true); }}
                        autoComplete="one-time-code"
                        data-form-type="other"
                        data-1p-ignore="true"
                        data-lpignore="true"
                        name="weight-log-value"
                        className={`flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white ${isTouch ? 'cursor-pointer' : ''}`} />
                      <DatePicker value={newWeightDate} onChange={setNewWeightDate}
                        max={todayLocalISO()}
                        className="flex-1 min-w-0"
                        inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <input type="search" placeholder={t('stats.memoPlaceholder')} value={newWeightMemo}
                      onChange={(e) => setNewWeightMemo(e.target.value)} maxLength={100} autoComplete="off"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white appearance-none outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-search-cancel-button]:hidden" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowWeightInput(false); setNewWeightMemo(''); }}
                        className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">{t('common.cancel')}</button>
                      <button onClick={handleAddWeight} disabled={!newWeight || weightSaving}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                        {weightSaving ? t('record.form.saving') : t('common.save')}
                      </button>
                    </div>
                    {showWeightPad && (
                      <NumberPad
                        value={newWeight}
                        onChange={setNewWeight}
                        decimal
                        maxIntDigits={3}
                        maxDecimals={2}
                        label={t('record.field.weight')}
                        suffix="kg"
                        onClose={() => setShowWeightPad(false)}
                      />
                    )}
                  </div>
                ) : (
                  <button onClick={() => {
                    if (!selectedPetId && pets.length === 1) setSelectedPetId(pets[0].id);
                    setShowWeightInput(true);
                  }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-500 text-sm font-medium hover:bg-blue-50 transition-colors">
                    <Plus size={16} /> {t('stats.addWeight')}
                  </button>
                )}

                {/* Weight history */}
                {weightData.length > 0 && (
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-gray-700 mb-2">{t('stats.history')} <span className="text-[11px] font-normal text-gray-400">· {t('stats.tapToDelete')}</span></h2>
                    {[...weightData].reverse().map((item) => {
                      const key = `${item.source}-${item.id}-${item.date}`;
                      const isSelected = selectedWeightId === key && item.source === 'log';
                      return (
                        <div
                          key={key}
                          onClick={() => item.source === 'log' ? setSelectedWeightId(isSelected ? null : key) : null}
                          className={`flex items-center justify-between py-2.5 px-2 border-b border-gray-50 rounded-lg transition-colors ${
                            isSelected ? 'bg-red-50' : item.source === 'log' ? 'active:bg-gray-50' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {new Date(item.date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', { month: 'numeric', day: 'numeric' })}
                              </span>
                              {!selectedPetId && item.petName && <span className="text-[11px] text-gray-400">{item.petName}</span>}
                              {item.source === 'record' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                                  {item.recordType === 'symptom' ? t('record.typeShort.symptom') : item.recordType === 'hospitalization' ? t('record.typeShort.hospitalization') : item.recordType === 'visit' ? t('record.typeShort.visit') : t('stats.recordGeneric')}
                                </span>
                              )}
                            </div>
                            {item.memo && <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1"><StickyNote size={11} className="flex-shrink-0" /><span className="truncate">{item.memo}</span></p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-sm font-semibold text-gray-700">{item.weight}kg</span>
                            {isSelected && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteWeight(item.id); setSelectedWeightId(null); }}
                                className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium"
                              >
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ METRIC TABS (음수/식사/수액) ═══ */}
        {METRIC_TABS.includes(tab as MetricType) && enabledTabs.includes(tab as MetricTabId) && user && (() => {
          const selPet = selectedPetId ? pets.find((p) => p.id === selectedPetId) : (pets.length === 1 ? pets[0] : null);
          if (!selPet) {
            const Icon = tab === 'water' ? Droplet : tab === 'food' ? Utensils : Syringe;
            return (
              <div className="text-center py-16">
                <Icon size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">{noPets ? t('common.registerPetFirst') : t('common.selectPet')}</p>
              </div>
            );
          }
          return (
            <MetricTracker
              userId={user.id}
              pet={selPet}
              metricType={tab as MetricType}
              period={period}
              startDate={startDate}
              endDate={endDate}
            />
          );
        })()}

        {/* ═══ 대소변 탭 ═══ */}
        {tab === 'excretion' && enabledTabs.includes('excretion') && user && (() => {
          const selPet = selectedPetId ? pets.find((p) => p.id === selectedPetId) : (pets.length === 1 ? pets[0] : null);
          if (!selPet) {
            return (
              <div className="text-center py-16">
                <CircleDot size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">{noPets ? t('common.registerPetFirst') : t('common.selectPet')}</p>
              </div>
            );
          }
          return (
            <ExcretionTracker
              userId={user.id}
              pet={selPet}
              period={period}
              startDate={startDate}
              endDate={endDate}
            />
          );
        })()}

        {/* ═══ 호흡수 탭 ═══ */}
        {tab === 'respiratory' && enabledTabs.includes('respiratory') && user && (() => {
          const selPet = selectedPetId ? pets.find((p) => p.id === selectedPetId) : (pets.length === 1 ? pets[0] : null);
          if (!selPet) {
            return (
              <div className="text-center py-16">
                <Wind size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">{noPets ? t('common.registerPetFirst') : t('common.selectPet')}</p>
              </div>
            );
          }
          return (
            <RespiratoryTracker
              userId={user.id}
              pet={selPet}
              period={period}
              startDate={startDate}
              endDate={endDate}
            />
          );
        })()}
      </div>
    </div>
  );
}
