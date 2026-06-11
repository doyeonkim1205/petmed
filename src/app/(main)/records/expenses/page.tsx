'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Stethoscope, Lock, Plus } from 'lucide-react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { todayLocalISO } from '@/lib/date';
import { DatePicker } from '@/components/ui/DatePicker';
import { OnboardHint } from '@/components/ui/OnboardHint';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

type Expense = { id: string; user_id: string; pet_id: string; category: string; reason: string; amount: number; spent_at: string; created_at?: string };

// 기록 cost + 직접 입력 지출을 한 형태로 병합한 항목.
type Item = {
  key: string;
  source: 'record' | 'direct';
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;
  title: string;
  hospital?: string;
  petName?: string;
};

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

  // 직접 입력 의료비
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

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

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    let q = supabase.from('expenses').select('*').eq('user_id', user.id).eq('category', 'medical');
    if (selectedPetId) q = q.eq('pet_id', selectedPetId);
    const { data } = await q;
    setExpenses((data as Expense[]) || []);
  }, [user, selectedPetId]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const { records, loading } = useHealthRecords(selectedPetId);
  const startDate = getStartDate(period, customStart);
  const endDate = getEndDate(period, customEnd);

  // 기록 cost + 직접 입력 병합 (기간 필터)
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of records) {
      if (!r.cost || r.cost <= 0) continue;
      const d = new Date(r.visit_date.split('T')[0] + 'T00:00:00'); // 로컬 자정 (UTC 파싱 함정 회피)
      if (d < startDate || d > endDate) continue;
      out.push({ key: `r-${r.id}`, source: 'record', id: r.id, date: r.visit_date.split('T')[0], amount: r.cost, title: r.title, hospital: r.hospital_name, petName: r.pets?.name });
    }
    for (const e of expenses) {
      const d = new Date(String(e.spent_at).split('T')[0] + 'T00:00:00'); // 로컬 자정
      if (d < startDate || d > endDate) continue;
      out.push({ key: `e-${e.id}`, source: 'direct', id: e.id, date: String(e.spent_at).split('T')[0], amount: Number(e.amount), title: e.reason || '의료비', petName: pets.find((p) => p.id === e.pet_id)?.name });
    }
    return out;
  }, [records, expenses, startDate, endDate, pets]);

  const stats = useMemo(() => {
    let total = 0;
    for (const it of items) total += it.amount;
    return { total, count: items.length };
  }, [items]);

  const monthlyGroups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Item[] }>();
    for (const it of items) {
      const d = new Date(it.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { label: formatMonthLabel(d.getFullYear(), d.getMonth()), total: 0, items: [] });
      const g = map.get(key)!;
      g.total += it.amount;
      g.items.push(it);
    }
    for (const g of map.values()) g.items.sort((a, b) => b.date.localeCompare(a.date));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g);
  }, [items]);

  // 추가 시 대상 펫 — 선택된 펫 or 1마리면 그 펫. 다마리 미선택이면 null(선택 요구).
  const resolvedPetId = selectedPetId || (pets.length === 1 ? pets[0].id : null);

  const handleAddExpense = async () => {
    if (!user || !resolvedPetId || !newAmount) return;
    const amount = Math.min(Math.max(0, Math.round(Number(newAmount) || 0)), 100000000);
    if (!amount) return;
    const today = todayLocalISO();
    const date = newDate > today ? today : newDate;
    setSaving(true);
    await supabase.from('expenses').insert({ user_id: user.id, pet_id: resolvedPetId, category: 'medical', reason: newReason.trim() || '의료비', amount, spent_at: date });
    setNewReason(''); setNewAmount(''); setShowAddInput(false); setSaving(false);
    fetchExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    setSelectedExpenseId(null);
    fetchExpenses();
  };

  return (
    <div className="bg-white min-h-full pb-20">
      <header className="relative flex items-center justify-center px-4 h-[60px] bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">의료비</h1>
      </header>

      {/* Pet filter — 제목 아래 밴드 (건강 통계와 동일) */}
      {pets.length > 1 && (
        <div className={`flex gap-1.5 overflow-x-auto max-w-sm mx-auto px-4 pt-1 pb-2 ${pets.length <= 4 ? 'justify-center' : ''}`}>
          <button onClick={() => setSelectedPetId(undefined)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedPetId ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
          {pets.map((pet) => (
            <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{pet.name}</button>
          ))}
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 py-4 space-y-5">
        <OnboardHint storageKey="hint_expense_record"
          text="기록장(진료·입퇴원)에 적은 진료비·입원비도 자동으로 여기에 모여요." />

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

            {/* Period selector — 요약 아래 */}
            <div className="flex gap-1.5 overflow-x-auto">
              {periodOptions.map((opt) => (
                <button key={opt.id} onClick={() => setPeriod(opt.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === opt.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{opt.label}</button>
              ))}
              {lockedOptions.map((opt) => (
                <button key={opt.id} onClick={() => router.push('/profile/subscription')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1">
                  <Lock size={11} />{opt.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex gap-2 items-center">
                <DatePicker value={customStart} onChange={setCustomStart} className="flex-1 min-w-0"
                  inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                <span className="text-gray-400 text-sm">~</span>
                <DatePicker value={customEnd} onChange={setCustomEnd} min={customStart} className="flex-1 min-w-0"
                  inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
              </div>
            )}

            {/* 의료비 직접 추가 */}
            {showAddInput ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                {!resolvedPetId ? (
                  <p className="text-xs text-amber-600 break-keep break-words">위에서 반려동물을 먼저 선택해주세요</p>
                ) : null}
                <input type="text" placeholder="지출 사유 (예: 수액 구매, 약 처방)" value={newReason}
                  onChange={(e) => setNewReason(e.target.value)} maxLength={50} autoComplete="off"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400 bg-white" />
                <div className="flex gap-2">
                  <input type="text" inputMode="numeric" placeholder="금액(원)" value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value.replace(/[^0-9]/g, ''))} autoComplete="off"
                    className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400 bg-white" />
                  <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-1 min-w-0"
                    inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddInput(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">취소</button>
                  <button onClick={handleAddExpense} disabled={!newAmount || !resolvedPetId || saving}
                    className="flex-1 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors">
                <Plus size={16} /> 의료비 추가
              </button>
            )}

            {monthlyGroups.length > 0 ? (
              <div className="space-y-4">
                {monthlyGroups.map((group) => (
                  <div key={group.label} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <h2 className="text-sm font-bold text-gray-700">{group.label}</h2>
                      <span className="text-sm font-bold text-blue-600">{formatCost(group.total)}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {group.items.map((it) => {
                        const dateLabel = new Date(it.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
                        const head = (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 flex-shrink-0">{dateLabel}</span>
                              {!selectedPetId && it.petName && <span className="text-[11px] text-gray-400 flex-shrink-0">{it.petName}</span>}
                              {it.source === 'record' && it.hospital && <span className="text-[11px] text-gray-400 truncate">{it.hospital}</span>}
                            </div>
                            <p className={`text-sm truncate mt-0.5 ${it.source === 'direct' ? 'text-gray-500' : 'text-gray-800'}`}>{it.title}</p>
                          </>
                        );
                        if (it.source === 'record') {
                          return (
                            <button key={it.key} onClick={() => router.push(`/records/${it.id}`)}
                              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors text-left">
                              <div className="min-w-0 flex-1">{head}</div>
                              <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-3">{formatCost(it.amount)}</span>
                            </button>
                          );
                        }
                        const sel = selectedExpenseId === it.id;
                        return (
                          <div key={it.key} onClick={() => setSelectedExpenseId(sel ? null : it.id)}
                            className={`w-full flex items-center justify-between py-3 px-4 transition-colors text-left ${sel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                            <div className="min-w-0 flex-1">{head}</div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="text-sm font-semibold text-gray-700">{formatCost(it.amount)}</span>
                              {sel && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteExpense(it.id); }}
                                  className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium">삭제</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Wallet size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">해당 기간에 의료비 기록이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
