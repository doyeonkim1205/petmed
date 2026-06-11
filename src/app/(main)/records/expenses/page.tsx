'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Stethoscope } from 'lucide-react';
import { PeriodDropdown } from '@/components/records/PeriodDropdown';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { supabase, Pet, HealthRecord } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

const allPeriodOptions: { id: Period; label: string; months: number }[] = [
  { id: 'month', label: '1개월', months: 1 },
  { id: '3month', label: '3개월', months: 3 },
  { id: 'year', label: '1년', months: 12 },
  { id: 'all', label: '전체', months: 200 },
  { id: 'custom', label: '직접 선택', months: 200 },
];

function getStartDate(period: Period, customStart?: string): Date {
  const now = new Date();
  switch (period) {
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0); return d; }
    case '3month': return new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    case 'year': return new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    case 'all': return new Date(2000, 0, 1);
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

export default function ExpensesPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const maxMonths = getPlanConfig(getEffectivePlan(profile?.plan)).costStatsMonths;

  const defaultPeriod: Period = maxMonths >= 12 ? 'year' : maxMonths >= 3 ? '3month' : 'month';
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);

  const periodOptions = allPeriodOptions.filter((p) => p.months <= maxMonths);
  const lockedOptions = allPeriodOptions.filter((p) => p.months > maxMonths);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        const defaultId = readDefaultPetId();
        const sorted = sortPetsWithDefault(data, defaultId);
        setPets(sorted);
        if (sorted.length === 1) setSelectedPetId(sorted[0].id);
        else if (defaultId && sorted.some((p) => p.id === defaultId)) setSelectedPetId(defaultId);
      }
      setPetsLoaded(true);
    });
  }, [user]);

  const { records, loading } = useHealthRecords(selectedPetId);
  const startDate = getStartDate(period, customStart);
  const endDate = getEndDate(period, customEnd);

  const filteredRecords = useMemo(() => records.filter((r) => {
    if (!r.cost || r.cost <= 0) return false;
    const d = new Date(r.visit_date);
    return d >= startDate && d <= endDate;
  }), [records, startDate, endDate]);

  const stats = useMemo(() => {
    let total = 0;
    for (const r of filteredRecords) total += r.cost!;
    return { total, count: filteredRecords.length };
  }, [filteredRecords]);

  const monthlyGroups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; records: HealthRecord[] }>();
    for (const r of filteredRecords) {
      const d = new Date(r.visit_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { label: formatMonthLabel(d.getFullYear(), d.getMonth()), total: 0, records: [] });
      const g = map.get(key)!;
      g.total += r.cost!;
      g.records.push(r);
    }
    for (const g of map.values()) g.records.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g);
  }, [filteredRecords]);

  return (
    <div className="bg-white min-h-full pb-20">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <header className="relative flex items-center justify-center px-4 h-[60px] max-w-sm mx-auto">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">의료비</h1>
        </header>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Pet filter */}
        {pets.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            <button onClick={() => setSelectedPetId(undefined)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedPetId ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
            {pets.map((pet) => (
              <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{pet.name}</button>
            ))}
          </div>
        )}

        {/* Period selector */}
        <PeriodDropdown
          value={period}
          options={periodOptions}
          lockedOptions={lockedOptions}
          onChange={(id) => setPeriod(id as Period)}
          onLocked={() => router.push('/profile/subscription')}
        />

        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <DatePicker value={customStart} onChange={setCustomStart} className="flex-1 min-w-0"
              inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
            <span className="text-gray-400 text-sm">~</span>
            <DatePicker value={customEnd} onChange={setCustomEnd} min={customStart} className="flex-1 min-w-0"
              inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
        )}

        {(!petsLoaded || loading) ? (
          <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Wallet size={18} className="mx-auto text-blue-500 mb-1" />
                <p className="text-[10px] text-blue-400 font-medium">총 의료비</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.total > 0 ? formatCost(stats.total) : '-'}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <Stethoscope size={18} className="mx-auto text-emerald-500 mb-1" />
                <p className="text-[10px] text-emerald-400 font-medium">지출 건수</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{stats.count > 0 ? `${stats.count}건` : '-'}</p>
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
                              <span className="text-xs text-gray-400 flex-shrink-0">{new Date(record.visit_date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
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
      </div>
    </div>
  );
}
