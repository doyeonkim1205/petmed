'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronDown, History,
  Building2, AlertTriangle, Stethoscope, PawPrint, ShieldCheck, Pill,
  CircleDot, Droplet, Utensils, GlassWater, Syringe, Scale, Wallet,
  type LucideIcon,
} from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { todayLocalISO } from '@/lib/date';
import { buildTimeline, TL_LABEL, type TLDay, type TLKind } from '@/lib/timeline';

// 이벤트 종류 → lucide 아이콘 (앱 톤 통일). 음수=GlassWater·소변=Droplet, 예방=ShieldCheck·수액=Syringe 로 겹침 정리.
const TL_ICON: Record<TLKind, LucideIcon> = {
  hospitalization: Building2, symptom: AlertTriangle, visit: Stethoscope, daily: PawPrint,
  preventive: ShieldCheck, med: Pill, poop: CircleDot, pee: Droplet,
  food: Utensils, water: GlassWater, fluid: Syringe, weight: Scale, cost: Wallet,
};

// 아이콘 색 — 앱 색 연상에 맞춤. 텍스트·칩 배경은 회색 유지, 아이콘만 색 포인트.
const TL_COLOR: Record<TLKind, string> = {
  hospitalization: 'text-emerald-500', symptom: 'text-orange-500', visit: 'text-blue-500', daily: 'text-purple-500',
  preventive: 'text-sky-500', med: 'text-rose-500', poop: 'text-amber-600', pee: 'text-yellow-500',
  food: 'text-orange-400', water: 'text-cyan-500', fluid: 'text-indigo-500', weight: 'text-slate-500', cost: 'text-teal-600',
};

const PERIODS: { id: string; label: string; days: number }[] = [
  { id: 'week', label: '1주', days: 7 },
  { id: 'month', label: '1개월', days: 30 },
  { id: '3month', label: '3개월', days: 90 },
];

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateHeader(dateK: string, todayStr: string, yesterdayStr: string): string {
  if (dateK === todayStr) return '오늘';
  if (dateK === yesterdayStr) return '어제';
  return new Date(`${dateK}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

export default function TimelinePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState('week');
  const [days, setDays] = useState<TLDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const todayStr = todayLocalISO();
  const yesterdayStr = daysAgoISO(1);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        const defaultId = readDefaultPetId();
        const sorted = sortPetsWithDefault(data, defaultId);
        setPets(sorted);
        if (sorted.length >= 1) {
          const def = defaultId && sorted.some((p) => p.id === defaultId) ? defaultId : sorted[0].id;
          setSelectedPetId(def);
        }
      }
      setPetsLoaded(true);
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!user || !selectedPetId) { setDays([]); setLoading(false); return; }
    setLoading(true);
    try {
      const startISO = daysAgoISO(PERIODS.find((p) => p.id === period)?.days ?? 7);
      const pid = selectedPetId;
      const [recs, meds, prevs, exc, mets, wts, exps] = await Promise.all([
        supabase.from('health_records').select('id, record_type, title, visit_date').eq('pet_id', pid).gte('visit_date', startISO),
        supabase.from('medications').select('id, name, alarm_times').eq('pet_id', pid),
        supabase.from('preventive_cares').select('id, category, name, last_done_date').eq('pet_id', pid).gte('last_done_date', startISO),
        supabase.from('excretion_logs').select('id, kind, condition, measured_at').eq('pet_id', pid).gte('measured_at', startISO),
        supabase.from('health_metrics').select('id, metric_type, value, unit, input_pct, measured_at').eq('pet_id', pid).gte('measured_at', startISO),
        supabase.from('weight_logs').select('id, weight, measured_at').eq('pet_id', pid).gte('measured_at', startISO),
        supabase.from('expenses').select('id, amount, reason, spent_at').eq('pet_id', pid).gte('spent_at', startISO),
      ]);

      const medRows = (meds.data || []) as Array<{ id: string; name: string; alarm_times: string[] | null }>;
      const medMeta = new Map<string, { name: string; alarm_times: string[] | null }>(
        medRows.map((m) => [m.id, { name: m.name, alarm_times: m.alarm_times }]),
      );
      const medIds = new Set(medRows.map((m) => m.id));
      // 복약 체크 — 펫 약에 속한 것만 (checks 엔 pet_id 없음)
      let checks: Array<{ id: string; medication_id: string; check_date: string; checked: boolean; checked_at?: string; dose_number?: number }> = [];
      if (medIds.size > 0) {
        const { data: ck } = await supabase
          .from('medication_checks')
          .select('id, medication_id, check_date, checked, checked_at, dose_number')
          .eq('user_id', user.id).gte('check_date', startISO);
        checks = (ck || []).filter((c: { medication_id: string }) => medIds.has(c.medication_id));
      }

      setDays(buildTimeline({
        records: recs.data || [],
        medMeta,
        checks,
        preventives: prevs.data || [],
        excretions: exc.data || [],
        metrics: mets.data || [],
        weights: wts.data || [],
        expenses: exps.data || [],
      }));
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'timeline', action: 'load' }, extra: { userId: user?.id } });
    } finally {
      setLoading(false);
    }
  }, [user, selectedPetId, period]);

  useEffect(() => { load(); }, [load]);

  // 로드되면 '오늘'은 기본 펼침
  useEffect(() => {
    if (days.some((d) => d.date === todayStr)) setExpanded(new Set([todayStr]));
    else setExpanded(new Set());
  }, [days, todayStr]);

  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] animate-pulse p-4 max-w-sm mx-auto">
        <div className="h-10 bg-gray-100 rounded-full mb-4 mt-4" />
        <div className="space-y-3"><div className="h-24 bg-gray-50 rounded-xl" /><div className="h-16 bg-gray-50 rounded-xl" /></div>
      </div>
    );
  }
  if (!user) return null;

  const noPets = petsLoaded && pets.length === 0;

  return (
    <div className="bg-white min-h-full pb-24">
      {/* 헤더 — 복약/예방과 동일 */}
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">타임라인</h1>
        </header>
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
        {/* 기간 필터 */}
        <div className="flex gap-1.5 max-w-sm mx-auto px-4 pb-2">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-2">
        {noPets ? (
          <div className="text-center py-16">
            <History size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">먼저 반려동물을 등록해주세요</p>
          </div>
        ) : (!petsLoaded || loading) ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : days.length === 0 ? (
          <div className="text-center py-16">
            <History size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">이 기간에 기록이 없어요</p>
            <p className="text-gray-300 text-xs mt-1">기간을 늘리거나 기록을 추가해보세요</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {days.map((d) => {
              const open = expanded.has(d.date);
              return (
                <div key={d.date} className="border border-gray-100 rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                  <button onClick={() => toggle(d.date)} className="w-full flex items-center justify-between">
                    <span className="text-[13px] font-bold text-gray-900">{fmtDateHeader(d.date, todayStr, yesterdayStr)}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {/* 중요 이벤트 (제목) */}
                  {d.titled.map((e) => {
                    const Icon = TL_ICON[e.kind];
                    return (
                      <button key={e.id} onClick={() => e.href && router.push(e.href)}
                        className="w-full flex items-center gap-1.5 text-left mt-1.5 active:opacity-60">
                        <Icon size={14} className={`flex-shrink-0 ${TL_COLOR[e.kind]}`} />
                        <span className="text-[13px] font-semibold text-gray-800 truncate">{e.text}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{TL_LABEL[e.kind]}</span>
                      </button>
                    );
                  })}

                  {/* 요약 칩 */}
                  {d.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.chips.map((c) => {
                        const Icon = TL_ICON[c.key as TLKind];
                        return (
                          <span key={c.key} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${c.abnormal ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            {Icon && <Icon size={12} className={`flex-shrink-0 ${TL_COLOR[c.key as TLKind]}`} />}{c.label}{c.abnormal ? ' · 주의' : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* 펼침 상세 — 시각순 */}
                  {open && (
                    <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200 space-y-0.5">
                      {d.events.map((e) => {
                        const Icon = TL_ICON[e.kind];
                        return (
                          <button key={e.id} onClick={() => e.href && router.push(e.href)}
                            className="w-full flex items-center gap-2 py-1.5 text-left rounded-lg active:bg-gray-50">
                            <span className="text-[11px] text-gray-400 tabular-nums w-9 flex-shrink-0">{e.time || ''}</span>
                            <Icon size={13} className={`flex-shrink-0 ${TL_COLOR[e.kind]}`} />
                            <span className="text-[13px] text-gray-700 flex-shrink-0">{TL_LABEL[e.kind]}</span>
                            <span className={`text-[13px] truncate ${e.abnormal ? 'text-red-600 font-medium' : 'text-gray-500'}`}>· {e.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
