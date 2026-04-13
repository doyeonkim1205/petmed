'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Stethoscope, TrendingUp, Lock, Scale, Plus, ArrowUpRight, ArrowDownRight, Minus, Trash2 } from 'lucide-react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig } from '@/lib/plans';
import { supabase, Pet, HealthRecord, WeightLog } from '@/lib/supabase';

type StatsTab = 'cost' | 'weight';
type Period = 'month' | '3month' | '6month' | 'year' | 'custom';

const allPeriodOptions: { id: Period; label: string; months: number }[] = [
  { id: 'month', label: '최근 1개월', months: 1 },
  { id: '3month', label: '최근 3개월', months: 3 },
  { id: '6month', label: '최근 6개월', months: 6 },
  { id: 'year', label: '최근 1년', months: 12 },
  { id: 'custom', label: '직접 선택', months: 12 },
];

function getStartDate(period: Period, customStart?: string): Date {
  const now = new Date();
  switch (period) {
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0); return d; }
    case '3month': { const d = new Date(now); d.setMonth(d.getMonth() - 3); d.setHours(0, 0, 0, 0); return d; }
    case '6month': { const d = new Date(now); d.setMonth(d.getMonth() - 6); d.setHours(0, 0, 0, 0); return d; }
    case 'year': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); d.setHours(0, 0, 0, 0); return d; }
    case 'custom': return customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function getEndDate(period: Period, customEnd?: string): Date {
  if (period === 'custom' && customEnd) { const d = new Date(customEnd); d.setHours(23, 59, 59, 999); return d; }
  return new Date();
}

function formatCost(cost: number): string {
  return new Intl.NumberFormat('ko-KR').format(cost) + '원';
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

// Sample data for chart: 1month=all, 3month=7day interval, 6month+=monthly
function sampleForChart(data: { date: string; weight: number }[], period: Period): { date: string; weight: number }[] {
  if (data.length <= 30) return data;
  if (period === 'month') return data;

  if (period === '3month' || period === '6month') {
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
  const W = 320, H = 160, PX = 32, PY = 20;
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
            <text x={PX - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{val}</text>
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
  const planConfig = getPlanConfig(profile?.plan || 'free');
  const maxMonths = planConfig.costStatsMonths;

  const [tab, setTab] = useState<StatsTab>('cost');
  const periodOptions = allPeriodOptions.filter(p => p.months <= maxMonths);
  const lockedOptions = allPeriodOptions.filter(p => p.months > maxMonths);

  const defaultPeriod = maxMonths >= 12 ? 'year' : maxMonths >= 3 ? '3month' : 'month';
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);

  // Weight states
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightLoading, setWeightLoading] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newWeightDate, setNewWeightDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightSaving, setWeightSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setPets(data);
          if (data.length === 1) setSelectedPetId(data[0].id);
        }
      });
  }, [user]);

  const { records, loading } = useHealthRecords(selectedPetId);
  const startDate = getStartDate(period, customStart);
  const endDate = getEndDate(period, customEnd);

  // ─── Cost data ──────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!r.cost || r.cost <= 0) return false;
      const d = new Date(r.visit_date);
      return d >= startDate && d <= endDate;
    });
  }, [records, startDate, endDate]);

  const stats = useMemo(() => {
    let total = 0;
    for (const r of filteredRecords) total += r.cost!;
    const count = filteredRecords.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [filteredRecords]);

  const monthlyGroups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; records: HealthRecord[] }>();
    for (const r of filteredRecords) {
      const d = new Date(r.visit_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { label: formatMonthLabel(d.getFullYear(), d.getMonth()), total: 0, records: [] });
      const group = map.get(key)!;
      group.total += r.cost!;
      group.records.push(r);
    }
    for (const group of map.values()) group.records.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g);
  }, [filteredRecords]);

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

  // Merge weight_logs + health_records weight, filter by period
  const weightData = useMemo(() => {
    const items: { date: string; weight: number; source: 'log' | 'record'; id: string; petName?: string; recordType?: string }[] = [];

    for (const log of weightLogs) {
      const d = new Date(log.measured_at);
      if (d >= startDate && d <= endDate) {
        items.push({ date: log.measured_at, weight: Number(log.weight), source: 'log', id: log.id, petName: pets.find(p => p.id === log.pet_id)?.name });
      }
    }

    for (const r of records) {
      if (r.weight && r.weight > 0) {
        if (!selectedPetId || r.pet_id === selectedPetId) {
          const d = new Date(r.visit_date);
          if (d >= startDate && d <= endDate) {
            items.push({ date: r.visit_date.split('T')[0], weight: r.weight, source: 'record', id: r.id, petName: r.pets?.name, recordType: r.record_type });
          }
        }
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date) || a.weight - b.weight);
    return items;
  }, [weightLogs, records, selectedPetId, pets, startDate, endDate]);

  // All weight data (no period filter) for latest/prev calculation
  const allWeightData = useMemo(() => {
    const items: { date: string; weight: number }[] = [];
    for (const log of weightLogs) {
      items.push({ date: log.measured_at, weight: Number(log.weight) });
    }
    for (const r of records) {
      if (r.weight && r.weight > 0 && (!selectedPetId || r.pet_id === selectedPetId)) {
        items.push({ date: r.visit_date.split('T')[0], weight: r.weight });
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
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
    const today = new Date().toISOString().split('T')[0];
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

  const needPetSelect = tab === 'weight' && !selectedPetId && pets.length > 1;

  // ─── Period selector (shared between tabs) ──────────────────────
  const PeriodSelector = () => (
    <div className="flex gap-1.5 overflow-x-auto">
      {periodOptions.map((p) => (
        <button key={p.id} onClick={() => setPeriod(p.id)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >{p.label}</button>
      ))}
      {lockedOptions.map((p) => (
        <div key={p.id} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1">
          <Lock size={10} />{p.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-14 max-w-sm mx-auto">
          <button onClick={() => router.back()} className="text-gray-600"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-gray-800">건강 통계</h1>
        </div>
        <div className="flex max-w-sm mx-auto border-b border-gray-100">
          <button onClick={() => setTab('cost')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'cost' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
            <Wallet size={14} className="inline -mt-0.5 mr-1" />의료비
          </button>
          <button onClick={() => setTab('weight')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'weight' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
            <Scale size={14} className="inline -mt-0.5 mr-1" />체중
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Pet filter */}
        {pets.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {tab === 'cost' && (
              <button onClick={() => setSelectedPetId(undefined)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedPetId ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                전체
              </button>
            )}
            {pets.map((pet) => (
              <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {pet.name}
              </button>
            ))}
          </div>
        )}

        {/* Period selector (shared) */}
        <PeriodSelector />

        {period === 'custom' && (
          <div>
            <div className="flex gap-2 items-center">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                min={(() => { const d = new Date(); d.setMonth(d.getMonth() - maxMonths); return d.toISOString().split('T')[0]; })()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-sm">~</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">최대 {maxMonths === 12 ? '1년' : `${maxMonths}개월`}까지 조회 가능</p>
          </div>
        )}

        {/* ═══ COST TAB ═══ */}
        {tab === 'cost' && (
          <>
            {loading ? (
              <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <Wallet size={18} className="mx-auto text-blue-500 mb-1" />
                    <p className="text-[10px] text-blue-400 font-medium">총 의료비</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.total > 0 ? formatCost(stats.total) : '-'}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <Stethoscope size={18} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-[10px] text-emerald-400 font-medium">진료 횟수</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.count > 0 ? `${stats.count}건` : '-'}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <TrendingUp size={18} className="mx-auto text-purple-500 mb-1" />
                    <p className="text-[10px] text-purple-400 font-medium">평균 비용</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.avg > 0 ? formatCost(stats.avg) : '-'}</p>
                  </div>
                </div>

                {monthlyGroups.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyGroups.map((group) => (
                      <div key={group.label} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                          <h2 className="text-sm font-bold text-gray-700">{group.label}</h2>
                          <span className="text-sm font-bold text-blue-600">{formatCost(group.total)}</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {group.records.map((record) => (
                            <button key={record.id} onClick={() => router.push(`/records/${record.id}`)}
                              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors text-left">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    {new Date(record.visit_date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                                  </span>
                                  {!selectedPetId && record.pets && <span className="text-[11px] text-gray-400 flex-shrink-0">{record.pets.name}</span>}
                                  {record.hospital_name && <span className="text-[11px] text-gray-400 truncate">{record.hospital_name}</span>}
                                </div>
                                <p className="text-sm text-gray-800 truncate mt-0.5">{record.title}</p>
                              </div>
                              <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-3">{formatCost(record.cost!)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Wallet size={40} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">해당 기간에 비용 기록이 없습니다.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ WEIGHT TAB ═══ */}
        {tab === 'weight' && (
          <>
            {needPetSelect ? (
              <div className="text-center py-16">
                <Scale size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">반려동물을 선택해주세요.</p>
              </div>
            ) : weightLoading ? (
              <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <>
                {/* Current weight summary */}
                <div className="rounded-xl bg-blue-50 p-4 flex items-center justify-between">
                  {latestWeight ? (
                    <>
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
                    </>
                  ) : (
                    <div className="w-full text-center py-2">
                      <Scale size={28} className="mx-auto text-blue-300 mb-1" />
                      <p className="text-sm text-gray-400">체중 기록이 없습니다.</p>
                    </div>
                  )}
                </div>

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
                      <input type="number" inputMode="decimal" step="0.01" min="0.1" max="100"
                        placeholder="체중 (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <input type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
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
                    {[...weightData].reverse().map((item) => (
                      <div key={`${item.source}-${item.id}-${item.date}`} className="flex items-center justify-between py-2.5 px-1 border-b border-gray-50">
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
                          {item.source === 'log' && (
                            <button onClick={() => handleDeleteWeight(item.id)}
                              className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
