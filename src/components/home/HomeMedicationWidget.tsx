'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Pill, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useMedications } from '@/hooks/useMedications';
import { MedicationCheck } from '@/lib/supabase';

type TFn = (key: string, values?: Record<string, string | number>) => string;

// 홈 "오늘의 복약" 위젯 — 평소엔 V5(한 줄 요약), 탭하면 V1(체크 리스트)로 펼침.
// 체크는 medication_checks 에 저장되어 캘린더와 동일 데이터(같은 테이블) 공유.
// 복용 중인 약이 없으면 null 반환 → 홈에서 자동 숨김.

function parseDoseCount(frequency: string): number {
  if (frequency.includes('3회')) return 3;
  if (frequency.includes('2회')) return 2;
  return 1;
}

function getDoseLabels(med: { frequency: string; alarm_times?: string[] | null }, t: TFn): string[] {
  const count = parseDoseCount(med.frequency);
  const times = med.alarm_times;
  if (times && times.length === count) return times;
  if (count === 1) return [t('home.medWidget.dose')];
  return Array.from({ length: count }, (_, i) => t('record.form.doseNth', { n: i + 1 }));
}

function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function HomeMedicationWidget() {
  const t = useTranslations();
  const [meds, setMeds] = useState<any[]>([]);
  const [checks, setChecks] = useState<MedicationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { getTodayMedications, getChecksForDate, toggleCheck } = useMedications();

  const today = localTodayISO();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        getTodayMedications(undefined, today),
        getChecksForDate(today),
      ]);
      setMeds(m);
      setChecks(c);
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'medications', action: 'home-widget-load' } });
    } finally {
      setLoading(false);
    }
  }, [getTodayMedications, getChecksForDate, today]);

  // 마운트 + 앱 내에서 홈('/')으로 복귀할 때마다 재조회.
  // Next.js 라우터 캐시로 위젯이 재마운트되지 않아도 pathname 변화로 잡는다
  // (복약 페이지에서 수정 후 뒤로가기 → 홈 복귀 시 stale 방지).
  useEffect(() => { if (pathname === '/') load(); }, [pathname, load]);

  // 외부 앱/탭 복귀(focus·visibility·bfcache) + 복약·예방 변경 즉시 반영.
  // 이 이벤트들은 SPA 이동 땐 안 터지므로 위 pathname 재조회와 병행.
  useEffect(() => {
    const onRefresh = () => { if (window.location.pathname === '/') load(); };
    const onVis = () => { if (document.visibilityState === 'visible') onRefresh(); };
    window.addEventListener('pageshow', onRefresh);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('pawdex:schedule-updated', onRefresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pageshow', onRefresh);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('pawdex:schedule-updated', onRefresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const handleToggle = async (medicationId: string, doseNumber: number) => {
    const isChecked = checks.some((c) => c.medication_id === medicationId && c.dose_number === doseNumber && c.checked);
    try {
      await toggleCheck(medicationId, today, !isChecked, doseNumber);
      setChecks(await getChecksForDate(today));
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'medications', action: 'home-widget-toggle' } });
    }
  };

  // 로딩 중엔 아무것도 안 띄움 — 복약 없는 대다수에게 빈 카드 깜빡임 방지.
  if (loading) return null;
  if (meds.length === 0) return null;

  const totalDoses = meds.reduce((sum, m) => sum + parseDoseCount(m.frequency), 0);
  const checkedCount = checks.filter((c) => c.checked).length;
  const allDone = checkedCount >= totalDoses;
  const pct = totalDoses ? Math.round((checkedCount / totalDoses) * 100) : 0;

  // 남은 약(완료 안 된 약) 기준 요약 문구.
  const remaining = meds.filter((m) => {
    const dc = parseDoseCount(m.frequency);
    const cc = checks.filter((c) => c.medication_id === m.id && c.checked).length;
    return cc < dc;
  });
  const summary = allDone
    ? t('home.medWidget.allDone')
    : remaining.length <= 1
      ? t('home.medWidget.remaining', { name: remaining[0]?.name ?? '' })
      : t('home.medWidget.remainingMore', { name: remaining[0].name, count: remaining.length - 1 });

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      {/* 접힌 상태 (V5) — 한 줄 요약 */}
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-none">
          <Pill size={18} className="text-rose-500" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900">{t('home.medWidget.title')}</p>
          <p className="text-[11px] text-gray-400 truncate">{summary}</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex-none ${allDone ? 'text-green-600 bg-green-50' : 'text-rose-500 bg-rose-50'}`}>
          {checkedCount}/{totalDoses}
        </span>
        <ChevronDown size={16} className={`text-gray-400 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* 펼친 상태 (V1) — 진행바 + 체크 리스트 */}
      {expanded && (
        <div className="px-3 pb-3">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2.5">
            <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="space-y-1.5">
            {meds.map((med) => {
              const doseCount = parseDoseCount(med.frequency);
              const labels = getDoseLabels(med, t);
              const petName = med.pets?.name;
              return labels.map((label, di) => {
                const isChecked = checks.some((c) => c.medication_id === med.id && c.dose_number === di && c.checked);
                return (
                  <button
                    key={`${med.id}-${di}`}
                    onClick={() => handleToggle(med.id, di)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${isChecked ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-none transition-colors ${isChecked ? 'bg-green-500 border-green-500 text-[#fff]' : 'border-gray-300'}`}>
                      {isChecked && <Check size={12} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      {doseCount === 1 ? (
                        <p className={`text-[13px] font-medium truncate ${isChecked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                          {med.name}{petName ? ` · ${petName}` : ''}
                        </p>
                      ) : (
                        <p className={`text-[13px] font-medium truncate ${isChecked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                          {med.name} <span className="text-gray-400 font-normal">{label}</span>{petName ? <span className="text-gray-400 font-normal"> · {petName}</span> : null}
                        </p>
                      )}
                    </div>
                  </button>
                );
              });
            })}
          </div>
          <button
            onClick={() => router.push('/records/meds')}
            className="mt-2 w-full flex items-center justify-center gap-0.5 py-2 text-[12px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
          >
            {t('record.module.meds')} <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
