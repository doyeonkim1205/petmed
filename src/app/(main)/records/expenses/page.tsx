'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft, Wallet, Plus, ChevronDown, ChevronUp, X, SlidersHorizontal,
  Stethoscope, Package, Cookie, ShieldCheck, Gamepad2, Scissors, Tag,
  type LucideIcon,
} from 'lucide-react';
import { FilterSheet, PeriodSection } from '@/components/records/FilterSheet';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketRegion } from '@/hooks/useMarketRegion';
import { currencyForRegion, formatMoney, type Currency } from '@/lib/region';
import { logActivity } from '@/lib/activityLog';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { todayLocalISO } from '@/lib/date';
import { DatePicker } from '@/components/ui/DatePicker';
import { OnboardHint } from '@/components/ui/OnboardHint';
import { NumberPad } from '@/components/ui/NumberPad';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

type Expense = { id: string; user_id: string; pet_id: string; category: string; reason: string; amount: number; spent_at: string; created_at?: string; currency?: Currency | null };

// 기록 cost + 직접 입력 지출을 한 형태로 병합한 항목. (category 포함 — 기록 비용은 medical)
type Item = {
  key: string;
  source: 'record' | 'direct';
  id: string;
  date: string;       // YYYY-MM-DD
  createdAt: string;  // ISO 입력 시각 — 같은 날짜 내 정렬(나중 입력이 위) 2차 키
  amount: number;
  currency: Currency;
  title: string;
  category: string;
  hospital?: string;
  petName?: string;
};

// 지출 카테고리 — expenses.category 와 동일 키. 기존 데이터('medical')는 '병원·의료'로 자동 매핑.
// 표시 라벨은 messages(expenses.category.*)로 분리 — id 로 t() 참조.
// label(한국어)은 빈 사유 저장 fallback(저장값)·비교용으로만 유지(표시 X).
const EXP_CATEGORIES: { id: string; label: string; Icon: LucideIcon; color: string }[] = [
  { id: 'medical', label: '병원·의료', Icon: Stethoscope, color: '#2563eb' },
  { id: 'food', label: '사료', Icon: Package, color: '#16a34a' },
  { id: 'snack', label: '간식', Icon: Cookie, color: '#f97316' },
  { id: 'insurance', label: '펫보험', Icon: ShieldCheck, color: '#0d9488' },
  { id: 'supplies', label: '용품·장난감', Icon: Gamepad2, color: '#9333ea' },
  { id: 'grooming', label: '미용', Icon: Scissors, color: '#db2777' },
  { id: 'other', label: '기타', Icon: Tag, color: '#64748b' },
];
const catMeta = (id: string) => EXP_CATEGORIES.find((c) => c.id === id) || EXP_CATEGORIES[EXP_CATEGORIES.length - 1];

// label 은 messages(expenses.period.*)로 분리 — id 로 참조.
const allPeriodOptions: { id: Period; months: number }[] = [
  { id: 'month', months: 1 },
  { id: '3month', months: 3 },
  { id: 'year', months: 12 },
  { id: 'all', months: 200 },
  { id: 'custom', months: 200 },
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

function formatMonthLabel(year: number, month: number, locale: string): string {
  if (locale === 'en') return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `${year}년 ${month + 1}월`;
}

export default function ExpensesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, profile } = useAuth();
  const region = useMarketRegion();
  const maxMonths = getPlanConfig(getEffectivePlan(profile?.plan)).costStatsMonths;

  const defaultPeriod: Period = maxMonths >= 12 ? 'year' : maxMonths >= 3 ? '3month' : 'month';
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);

  // 카테고리 필터(범례 탭) + 범례 펼침
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // 직접 입력 지출
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState('medical');
  const [newReason, setNewReason] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [showAmountPad, setShowAmountPad] = useState(false);
  useEffect(() => {
    setIsTouch(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

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

  // 모든 카테고리의 직접 입력 지출 fetch (이전엔 medical 만)
  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    let q = supabase.from('expenses').select('*').eq('user_id', user.id);
    if (selectedPetId) q = q.eq('pet_id', selectedPetId);
    const { data } = await q;
    setExpenses((data as Expense[]) || []);
  }, [user, selectedPetId]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const { records, loading } = useHealthRecords(selectedPetId);
  const startDate = getStartDate(period, customStart);
  const endDate = getEndDate(period, customEnd);

  // 기록 cost(=병원·의료) + 직접 입력 병합 (기간 필터)
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of records) {
      const rCost = Number(r.cost); // health_records.cost 는 numeric → Supabase 가 문자열 반환, 숫자로 변환 후 사용
      if (!rCost || rCost <= 0) continue;
      const d = new Date(r.visit_date.split('T')[0] + 'T00:00:00');
      if (d < startDate || d > endDate) continue;
      out.push({ key: `r-${r.id}`, source: 'record', id: r.id, date: r.visit_date.split('T')[0], createdAt: r.created_at || '', amount: rCost, currency: (r.currency as Currency) ?? 'KRW', title: r.title, category: 'medical', hospital: r.hospital_name, petName: r.pets?.name });
    }
    for (const e of expenses) {
      const d = new Date(String(e.spent_at).split('T')[0] + 'T00:00:00');
      if (d < startDate || d > endDate) continue;
      out.push({ key: `e-${e.id}`, source: 'direct', id: e.id, date: String(e.spent_at).split('T')[0], createdAt: e.created_at || '', amount: Number(e.amount), currency: (e.currency as Currency) ?? 'KRW', title: e.reason || t('expenses.category.' + (e.category || 'medical')), category: e.category || 'medical', petName: pets.find((p) => p.id === e.pet_id)?.name });
    }
    return out;
  }, [records, expenses, startDate, endDate, pets, t]);

  // 카테고리별 합계 (전체 — 도넛/범례용)
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.category, (map.get(it.category) || 0) + it.amount);
    return map;
  }, [items]);

  const grandTotal = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  // 표시용 통화 — 항목들의 통화(현재는 단일 통화가 일반적). 없으면 지역 기본값.
  // ⚠️ 진짜 혼합통화(KR→US 이동) 유저의 통화별 분리 합계는 후속(현재 해당 유저 0명).
  const displayCurrency: Currency = items[0]?.currency ?? currencyForRegion(region);

  // 도넛 세그먼트 (카테고리 순서)
  const segments = useMemo(() => EXP_CATEGORIES.map((c) => ({ value: categoryTotals.get(c.id) || 0, color: c.color })), [categoryTotals]);

  // 범례 (값 있는 카테고리만, 큰 순)
  const legendRows = useMemo(() => EXP_CATEGORIES
    .map((c) => ({ ...c, value: categoryTotals.get(c.id) || 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value), [categoryTotals]);

  // 필터 적용 항목 → 월별 그룹
  const filteredItems = useMemo(() => selectedCategory ? items.filter((it) => it.category === selectedCategory) : items, [items, selectedCategory]);

  const monthlyGroups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Item[] }>();
    for (const it of filteredItems) {
      const d = new Date(it.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { label: formatMonthLabel(d.getFullYear(), d.getMonth(), locale), total: 0, items: [] });
      const g = map.get(key)!;
      g.total += it.amount;
      g.items.push(it);
    }
    // 날짜 내림차순, 같은 날짜면 나중에 입력한(created_at 큰) 항목이 위로.
    for (const g of map.values()) g.items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, g]) => g);
  }, [filteredItems, locale]);

  const resolvedPetId = selectedPetId || (pets.length === 1 ? pets[0].id : null);

  const handleAddExpense = async () => {
    if (!user || !resolvedPetId || !newAmount) return;
    const amount = Math.min(Math.max(0, Math.round(Number(newAmount) || 0)), 100000000);
    if (!amount) return;
    const today = todayLocalISO();
    const date = newDate > today ? today : newDate;
    setSaving(true);
    const { data: exp } = await supabase.from('expenses').insert({ user_id: user.id, pet_id: resolvedPetId, category: newCategory, reason: newReason.trim() || catMeta(newCategory).label, amount, spent_at: date, currency: currencyForRegion(region) }).select('id').single();
    // 액션만 기록(금액·사유 등 내용 X).
    if (exp) logActivity(user.id, 'expense.create', { resourceType: 'expense', resourceId: exp.id });
    setNewReason(''); setNewAmount(''); setShowAddInput(false); setSaving(false);
    fetchExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    if (user) logActivity(user.id, 'expense.delete', { resourceType: 'expense', resourceId: id });
    setSelectedExpenseId(null);
    fetchExpenses();
  };

  return (
    <div className="bg-white min-h-full pb-20">
      <div className="sticky top-0 z-30 bg-white relative">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">{t('record.module.expenses')}</h1>
          <button onClick={() => setShowFilter(true)} className="absolute right-2 p-2 text-gray-400" aria-label={t('common.filter')}>
            <SlidersHorizontal size={16} />
          </button>
        </header>
        <div className="absolute left-1/2 top-[50px] z-20 w-64 max-w-[88%] -translate-x-1/2">
          <OnboardHint storageKey="hint_expense_record_v2" pointer="center"
            text={t('expenses.hint', { category: t('expenses.category.medical') })} />
        </div>
      </div>

      {/* 필터 바텀시트 — 기간 */}
      <FilterSheet open={showFilter} title={t('common.filter')} closeLabel={t('common.close')} doneLabel={t('common.done')} onClose={() => setShowFilter(false)}>
        <PeriodSection
          label={t('common.period')}
          value={period}
          onChange={(id) => setPeriod(id as Period)}
          options={periodOptions.map((opt) => ({ id: opt.id, label: t(`expenses.period.${opt.id}`) }))}
          lockedOptions={lockedOptions.map((opt) => ({ id: opt.id, label: t(`expenses.period.${opt.id}`) }))}
          onLockedClick={() => router.push('/profile/subscription')}
        />
        {period === 'custom' && (
          <div className="mt-3 flex gap-2 items-center">
            <DatePicker value={customStart} onChange={setCustomStart} className="flex-1 min-w-0"
              inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
            <span className="text-gray-400 text-sm">~</span>
            <DatePicker value={customEnd} onChange={setCustomEnd} min={customStart} className="flex-1 min-w-0"
              inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
        )}
      </FilterSheet>

      {/* Pet filter */}
      {pets.length > 1 && (
        <div className={`flex gap-1.5 overflow-x-auto max-w-sm mx-auto px-4 pt-1 pb-2 ${pets.length <= 4 ? 'justify-center' : ''}`}>
          <button onClick={() => setSelectedPetId(undefined)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedPetId ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{t('common.all')}</button>
          {pets.map((pet) => (
            <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{pet.name}</button>
          ))}
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 pt-1 pb-4 space-y-4">
        {(!petsLoaded || loading) ? (
          <div className="space-y-3 py-8">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : pets.length === 0 ? (
          <div className="text-center py-16">
            <Wallet size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">{t('common.registerPetFirst')}</p>
          </div>
        ) : (
          <>
            {/* 총액 + 누적 막대 + 접이식 범례 */}
            {grandTotal > 0 ? (
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-[11px] text-gray-400">{t('expenses.totalSpent', { period: t(`expenses.period.${period}`) })}</p>
                <p className="text-xl font-bold text-gray-800 mb-2.5">{formatMoney(grandTotal, displayCurrency, locale)}</p>
                {/* 카테고리별 누적 막대 */}
                <div className="flex w-full h-3.5 rounded-full overflow-hidden bg-gray-100">
                  {segments.filter((s) => s.value > 0).map((s, i) => (
                    <div key={i} style={{ width: `${(s.value / grandTotal) * 100}%`, backgroundColor: s.color }} />
                  ))}
                </div>
                <button onClick={() => setLegendOpen((v) => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-gray-100 bg-gray-50/60 text-xs font-bold text-gray-500">
                  {legendOpen ? t('expenses.byCategoryHide') : t('expenses.byCategoryShow')} {legendOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {legendOpen && (
                  <div className="w-full mt-2 space-y-0.5">
                    {legendRows.map((c) => {
                      const sel = selectedCategory === c.id;
                      const pct = grandTotal > 0 ? Math.round((c.value / grandTotal) * 100) : 0;
                      return (
                        <button key={c.id} onClick={() => setSelectedCategory(sel ? null : c.id)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${sel ? 'bg-blue-50' : 'active:bg-gray-50'}`}>
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className={`text-xs flex-1 text-left ${sel ? 'font-bold text-blue-600' : 'text-gray-600'}`}>{t(`expenses.category.${c.id}`)}</span>
                          <span className="text-xs font-semibold text-gray-700">{formatMoney(c.value, displayCurrency, locale)}</span>
                          <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 py-10 text-center">
                <Wallet size={36} className="mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">{t('expenses.empty')}</p>
              </div>
            )}

            {/* 필터 표시 */}
            {selectedCategory && (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-blue-600">{t('expenses.filterActive', { category: t(`expenses.category.${selectedCategory}`) })}</span>
                <button onClick={() => setSelectedCategory(null)} className="text-xs text-blue-500 inline-flex items-center gap-0.5">
                  <X size={12} /> {t('common.all')}
                </button>
              </div>
            )}


            {/* 지출 직접 추가 */}
            {showAddInput ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                {!resolvedPetId ? (
                  <p className="text-xs text-amber-600 break-keep break-words">{t('expenses.selectPetAbove')}</p>
                ) : null}
                {/* 카테고리 선택 */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">{t('common.category')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXP_CATEGORIES.map((c) => {
                      const Icon = c.Icon;
                      const on = newCategory === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => setNewCategory(c.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${on ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-gray-200 text-gray-500'}`}>
                          <Icon size={12} />{t(`expenses.category.${c.id}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input type="search" placeholder={t('expenses.reasonPlaceholder')} value={newReason}
                  onChange={(e) => setNewReason(e.target.value)} maxLength={50}
                  autoComplete="off" data-form-type="other" data-1p-ignore="true" data-lpignore="true" name="expense-memo-reason"
                  enterKeyHint="done"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400 bg-white appearance-none [&::-webkit-search-cancel-button]:hidden" />
                <div className="flex gap-2">
                  <input type="text"
                    inputMode={isTouch ? 'none' : 'numeric'}
                    placeholder={t('expenses.amountPlaceholder')} value={newAmount ? Number(newAmount).toLocaleString() : ''}
                    onChange={(e) => setNewAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                    readOnly={isTouch}
                    onClick={() => { if (isTouch) setShowAmountPad(true); }}
                    autoComplete="off" data-form-type="other" data-1p-ignore="true" data-lpignore="true" name="expense-amount-value"
                    className={`flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gray-400 bg-white ${isTouch ? 'cursor-pointer' : ''}`} />
                  <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-1 min-w-0"
                    inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddInput(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">{t('common.cancel')}</button>
                  <button onClick={handleAddExpense} disabled={!newAmount || !resolvedPetId || saving}
                    className="flex-1 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-40">
                    {saving ? t('record.form.saving') : t('common.save')}
                  </button>
                </div>
                {showAmountPad && (
                  <NumberPad value={newAmount} onChange={setNewAmount} decimal={false} maxIntDigits={9} thousands label={t('expenses.amount')} suffix={t('record.form.wonSuffix')} onClose={() => setShowAmountPad(false)} />
                )}
              </div>
            ) : (
              <button onClick={() => setShowAddInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors">
                <Plus size={16} /> {t('expenses.addExpense')}
              </button>
            )}

            {monthlyGroups.length > 0 && (
              <div className="space-y-4">
                {monthlyGroups.map((group) => (
                  <div key={group.label} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <h2 className="text-sm font-bold text-gray-700">{group.label}</h2>
                      <span className="text-sm font-bold text-blue-600">{formatMoney(group.total, displayCurrency, locale)}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {group.items.map((it) => {
                        const dateLabel = new Date(it.date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', { month: 'numeric', day: 'numeric' });
                        const cm = catMeta(it.category);
                        const CatIcon = cm.Icon;
                        const head = (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 flex-shrink-0">{dateLabel}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                                <CatIcon size={10} />{t(`expenses.category.${it.category}`)}
                              </span>
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
                              <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-3">{formatMoney(it.amount, it.currency, locale)}</span>
                            </button>
                          );
                        }
                        const sel = selectedExpenseId === it.id;
                        return (
                          <div key={it.key} onClick={() => setSelectedExpenseId(sel ? null : it.id)}
                            className={`w-full flex items-center justify-between py-3 px-4 transition-colors text-left ${sel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                            <div className="min-w-0 flex-1">{head}</div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="text-sm font-semibold text-gray-700">{formatMoney(it.amount, it.currency, locale)}</span>
                              {sel && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteExpense(it.id); }}
                                  className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium">{t('common.delete')}</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
