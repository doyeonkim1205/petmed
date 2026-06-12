'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Scale, Plus, ArrowUpRight, ArrowDownRight, Minus, Droplet, Utensils, Syringe, SlidersHorizontal, Check } from 'lucide-react';
import { MetricTracker } from '@/components/records/MetricTracker';
import type { MetricType } from '@/lib/healthMetrics';
import { getEnabledStatsTabs, setEnabledStatsTabs, ALL_METRIC_TABS, STATS_TAB_LABELS, type MetricTabId } from '@/lib/statsTabPrefs';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { supabase, Pet, WeightLog } from '@/lib/supabase';
import { todayLocalISO } from '@/lib/date';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { OnboardHint } from '@/components/ui/OnboardHint';

type StatsTab = 'weight' | 'water' | 'food' | 'fluid';
const METRIC_TABS: MetricType[] = ['water', 'food', 'fluid'];
type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

const allPeriodOptions: { id: Period; label: string; months: number }[] = [
  { id: 'month', label: '1개월', months: 1 },
  { id: '3month', label: '3개월', months: 3 },
  { id: 'year', label: '1년', months: 12 },
  // "전체" 와 "직접 선택" 은 큰 값 (200 개월 = 16년+) 으로 Free(3) 에선 자물쇠,
  // Plus(999) 에선 사용 가능하게 분류.
  { id: 'all', label: '전체', months: 200 },
  { id: 'custom', label: '직접 선택', months: 200 },
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
  return new Date();
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
      const next = removing ? prev.filter((t) => t !== id) : [...prev, id];
      setEnabledStatsTabs(next);
      if (next.length > 0 && !next.includes(tab as MetricTabId)) setTab(next[0]);
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
    if (t && (['weight', 'water', 'food', 'fluid'] as string[]).includes(t)) {
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
  const [newWeightDate, setNewWeightDate] = useState(todayLocalISO());
  // Chrome autofill 차단 readonly trick.
  const [newWeightFocused, setNewWeightFocused] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);

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
    const items: { date: string; weight: number; source: 'log' | 'record'; id: string; createdAt: string; petName?: string; recordType?: string }[] = [];

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
    await supabase.from('weight_logs').insert({ user_id: user.id, pet_id: selectedPetId, weight: w, measured_at: date });
    setNewWeight('');
    setShowWeightInput(false);
    setWeightSaving(false);
    fetchWeightLogs();
  };

  const handleDeleteWeight = async (id: string) => {
    await supabase.from('weight_logs').delete().eq('id', id);
    fetchWeightLogs();
  };

  const [selectedWeightId, setSelectedWeightId] = useState<string | null>(null);

  const needPetSelect = tab === 'weight' && !selectedPetId && pets.length > 1;

  // ─── Period selector (shared between tabs) ──────────────────────
  return (
    <div className="bg-white min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white relative">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">건강 통계</h1>
          <button onClick={() => setShowTabSettings((v) => !v)} className="absolute right-2 p-2 text-gray-400" aria-label="표시 지표 설정">
            <SlidersHorizontal size={16} />
          </button>
        </header>

        {/* 필터 안내 말풍선 — 필터 버튼 바로 아래 붙음 (첫 방문 1회) */}
        <div className="absolute right-2 top-[50px] z-20 w-64">
          <OnboardHint storageKey="hint_stats_filter" pointer="right"
            text={"여기서 보고 싶은 지표\n(체중·음수량·식사·수액)를 고를 수가 있어요."} />
        </div>

        {/* 표시 지표 설정 팝오버 */}
        {showTabSettings && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowTabSettings(false)} />
            <div className="absolute right-3 top-[52px] z-40 w-28 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
              <p className="text-[10px] text-gray-400 px-2 pt-1 pb-1 break-keep break-words">표시할 지표</p>
              {ALL_METRIC_TABS.map((id) => {
                const on = enabledTabs.includes(id);
                return (
                  <button key={id} onClick={() => toggleStatTab(id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs">
                    <span className={on ? 'text-gray-800 font-medium' : 'text-gray-400'}>{STATS_TAB_LABELS[id]}</span>
                    {on && <Check size={13} className="text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </>
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
        <div className="flex max-w-sm mx-auto">
          {([
            { id: 'weight', label: '체중', Icon: Scale },
            { id: 'water', label: '음수량', Icon: Droplet },
            { id: 'food', label: '식사', Icon: Utensils },
            { id: 'fluid', label: '수액', Icon: Syringe },
          ] as const).filter((t) => enabledTabs.includes(t.id)).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Period selector (chips) */}
        <div className="flex gap-1.5 overflow-x-auto">
          {periodOptions.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{p.label}</button>
          ))}
          {lockedOptions.map((p) => (
            <button key={p.id} onClick={() => router.push('/profile/subscription')}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1">
              <Lock size={11} />{p.label}
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
            <p className="text-[11px] text-gray-400 mt-1">시작/종료 날짜를 자유롭게 선택하세요</p>
          </div>
        )}

        {enabledTabs.length === 0 && (
          <div className="rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400 break-keep break-words">
            표시할 지표가 없어요. 마이페이지 &gt; 앱 설정에서 켜주세요.
          </div>
        )}

        {/* ═══ WEIGHT TAB ═══ */}
        {tab === 'weight' && enabledTabs.includes('weight') && (
          <>
            {(!petsLoaded || weightLoading) ? (
              <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : needPetSelect ? (
              <div className="text-center py-16">
                <Scale size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">반려동물을 선택해주세요</p>
              </div>
            ) : (
              <>
                {/* Current weight summary */}
                {latestWeight ? (
                  <div className="rounded-xl bg-blue-50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-blue-400 font-medium">
                        {pets.find(p => p.id === selectedPetId)?.name || '현재'} 체중
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
                        <Minus size={12} /> 변화없음
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 py-8 text-center">
                    <Scale size={32} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-sm text-gray-400">아직 체중 기록이 없어요</p>
                  </div>
                )}

                <OnboardHint storageKey="hint_stats_weight_record" pointer="center"
                  text="기록장(진료·입퇴원)에 적은 체중도 자동으로 여기에 모여요." />

                {/* Chart */}
                {chartData.length >= 2 && (
                  <div className="rounded-xl border border-gray-100 p-4">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">체중 변화</h2>
                    <WeightChart data={chartData} />
                    <div className="flex justify-center gap-6 mt-3">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">최저</p>
                        <p className="text-sm font-bold text-blue-600">{weightMin}kg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">최고</p>
                        <p className="text-sm font-bold text-red-500">{weightMax}kg</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weight input */}
                {showWeightInput ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                    <div className="flex gap-2">
                      <input type="text" inputMode="decimal"
                        placeholder="체중 (kg)" value={newWeight}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setNewWeight(v);
                        }}
                        readOnly={!newWeightFocused}
                        onFocus={() => setNewWeightFocused(true)}
                        onBlur={() => setNewWeightFocused(false)}
                        autoComplete="one-time-code"
                        data-form-type="other"
                        data-1p-ignore="true"
                        data-lpignore="true"
                        name="weight-log-value"
                        className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <DatePicker value={newWeightDate} onChange={setNewWeightDate}
                        max={todayLocalISO()}
                        className="flex-1 min-w-0"
                        inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowWeightInput(false)}
                        className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">취소</button>
                      <button onClick={handleAddWeight} disabled={!newWeight || weightSaving}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                        {weightSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => {
                    if (!selectedPetId && pets.length === 1) setSelectedPetId(pets[0].id);
                    setShowWeightInput(true);
                  }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-500 text-sm font-medium hover:bg-blue-50 transition-colors">
                    <Plus size={16} /> 체중 기록
                  </button>
                )}

                {/* Weight history */}
                {weightData.length > 0 && (
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-gray-700 mb-2">기록 내역</h2>
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {new Date(item.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                            </span>
                            {!selectedPetId && item.petName && <span className="text-[11px] text-gray-400">{item.petName}</span>}
                            {item.source === 'record' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                                {item.recordType === 'symptom' ? '증상' : item.recordType === 'hospitalization' ? '입퇴원' : item.recordType === 'visit' ? '진료' : '기록'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">{item.weight}kg</span>
                            {isSelected && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteWeight(item.id); setSelectedWeightId(null); }}
                                className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium"
                              >
                                삭제
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
                <p className="text-gray-400 text-sm">반려동물을 선택해주세요</p>
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
      </div>
    </div>
  );
}
