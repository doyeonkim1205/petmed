'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Stethoscope, TrendingUp, Lock } from 'lucide-react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig } from '@/lib/plans';
import { supabase, Pet } from '@/lib/supabase';

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
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '3month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case '6month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'custom':
      return customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function getEndDate(period: Period, customEnd?: string): Date {
  if (period === 'custom' && customEnd) {
    const d = new Date(customEnd);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date();
}

function formatMonth(year: number, month: number): string {
  return `${year}.${String(month + 1).padStart(2, '0')}`;
}

function formatCost(cost: number): string {
  return new Intl.NumberFormat('ko-KR').format(cost) + '원';
}

export default function StatsPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const planConfig = getPlanConfig(profile?.plan || 'free');
  const maxMonths = planConfig.costStatsMonths;

  const periodOptions = allPeriodOptions.filter(p => p.months <= maxMonths);
  const lockedOptions = allPeriodOptions.filter(p => p.months > maxMonths);

  const defaultPeriod = maxMonths >= 12 ? 'year' : maxMonths >= 3 ? '3month' : 'month';
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)
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

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!r.cost || r.cost <= 0) return false;
      const d = new Date(r.visit_date);
      return d >= startDate && d <= endDate;
    });
  }, [records, startDate, endDate]);

  const stats = useMemo(() => {
    let total = 0;
    for (const r of filteredRecords) {
      total += r.cost!;
    }
    const count = filteredRecords.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [filteredRecords]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRecords) {
      const d = new Date(r.visit_date);
      const key = formatMonth(d.getFullYear(), d.getMonth());
      map.set(key, (map.get(key) || 0) + r.cost!);
    }
    // Sort by key (year.month)
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const maxValue = entries.length > 0 ? Math.max(...entries.map(e => e[1])) : 0;
    return { entries, maxValue };
  }, [filteredRecords]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort(
      (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
    );
  }, [filteredRecords]);

  return (
    <div className="bg-white min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-14 max-w-sm mx-auto">
          <button onClick={() => router.back()} className="text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-gray-800">의료비 통계</h1>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        {/* Period selector */}
        <div className="flex gap-1.5 overflow-x-auto">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                period === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          {lockedOptions.map((p) => (
            <div
              key={p.id}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1"
            >
              <Lock size={10} />
              {p.label}
            </div>
          ))}
        </div>

        {/* Pet filter */}
        {pets.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedPetId(undefined)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedPetId
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedPetId === pet.id
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {pet.name}
              </button>
            ))}
          </div>
        )}

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                min={(() => { const d = new Date(); d.setMonth(d.getMonth() - maxMonths); return d.toISOString().split('T')[0]; })()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">최대 {maxMonths === 12 ? '1년' : `${maxMonths}개월`}까지 조회 가능</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Wallet size={18} className="mx-auto text-blue-500 mb-1" />
                <p className="text-[10px] text-blue-400 font-medium">총 의료비</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">
                  {stats.total > 0 ? formatCost(stats.total) : '-'}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <Stethoscope size={18} className="mx-auto text-emerald-500 mb-1" />
                <p className="text-[10px] text-emerald-400 font-medium">진료 횟수</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">
                  {stats.count > 0 ? `${stats.count}건` : '-'}
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <TrendingUp size={18} className="mx-auto text-purple-500 mb-1" />
                <p className="text-[10px] text-purple-400 font-medium">평균 비용</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">
                  {stats.avg > 0 ? formatCost(stats.avg) : '-'}
                </p>
              </div>
            </div>

            {/* Monthly bar chart */}
            {monthlyData.entries.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-gray-700">월별 의료비</h2>
                <div className="space-y-2">
                  {monthlyData.entries.map(([month, amount]) => (
                    <div key={month} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12 flex-shrink-0">{month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max((amount / monthlyData.maxValue) * 100, 5)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-600 font-medium whitespace-nowrap flex-shrink-0">
                        {formatCost(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Record list */}
            {sortedRecords.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-gray-700">비용 기록</h2>
                {sortedRecords.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => router.push(`/records/${record.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400">
                        {new Date(record.visit_date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm font-medium text-gray-800 truncate">{record.title}</p>
                      <div className="flex items-center gap-1.5">
                        {!selectedPetId && record.pets && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">
                            {record.pets.name}
                          </span>
                        )}
                        {record.hospital_name && (
                          <p className="text-xs text-gray-400 truncate">{record.hospital_name}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0 ml-3">
                      {formatCost(record.cost!)}
                    </span>
                  </button>
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
