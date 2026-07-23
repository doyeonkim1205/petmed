'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Pill, Check } from 'lucide-react';
import { useMedications } from '@/hooks/useMedications';
import { MedicationCheck } from '@/lib/supabase';

interface MedicationCheckListProps {
  petId?: string;
  date?: string;
  card?: boolean;   // 홈에서 흰 카드로 감싸 노출 (복약 있을 때만 — 빈 경우 null 반환이라 카드도 안 뜸)
}

function parseDoseCount(frequency: string): number {
  if (frequency.includes('3회')) return 3;
  if (frequency.includes('2회')) return 2;
  return 1;
}

// 저장된 빈도(한국어 고정값, DB canonical) → 로케일 라벨 키. meds/page.tsx freqDisplay 와 동일 규칙.
// (레거시 자유입력 빈도는 매핑에 없으면 원본 그대로 표시)
const FREQ_LABEL_KEY: Record<string, string> = {
  '1일 1회': 'onceDaily',
  '1일 2회': 'twiceDaily',
  '1일 3회': 'thriceDaily',
};

export function MedicationCheckList({ petId, date, card }: MedicationCheckListProps) {
  const t = useTranslations();
  const [medications, setMedications] = useState<any[]>([]);
  const [checks, setChecks] = useState<MedicationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const { getTodayMedications, getChecksForDate, toggleCheck } = useMedications();

  const today = date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    loadData();
  }, [petId, today]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meds, chks] = await Promise.all([
        getTodayMedications(petId || undefined, today),
        getChecksForDate(today),
      ]);
      setMedications(meds);
      setChecks(chks);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'medications', action: 'load-check-list' },
      });
      console.error('Error loading medication data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (medicationId: string, doseNumber: number) => {
    const isChecked = checks.some(
      (c) => c.medication_id === medicationId && c.dose_number === doseNumber && c.checked
    );

    try {
      await toggleCheck(medicationId, today, !isChecked, doseNumber);
      const newChecks = await getChecksForDate(today);
      setChecks(newChecks);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'medications', action: 'toggle-check' },
      });
      console.error('Error toggling check:', error);
    }
  };

  if (loading) {
    // 카드 변형(홈)에선 로딩 중 빈 골격을 띄우지 않음 — 복약 없는 대다수에게
    // 빈 카드가 깜빡이는 것 방지. 약이 확정되면 그때 카드가 나타남.
    if (card) return null;
    return (
      <div className="px-4 py-3">
        <div className="h-6 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (medications.length === 0) return null;

  // 회차 단위로 평탄화 후 시각순 정렬 (홈 위젯과 동일한 "시간표"). 색점으로 약을 구분.
  // 회차 수의 진실원은 doseCount(빈도)라 alarm_times 가 아니라 doseCount 로 펼침 → 알람 OFF 약도
  // 회차만큼 남아 맨 아래로 가고, 체크(dose_number 0..n-1) 무결성도 유지됨.
  type DoseItem = {
    medId: string; doseIndex: number; time: string | null; hasTime: boolean;
    ordinal: string | null; freqHint: string | null; color: string; petName?: string; medName: string;
  };
  const doses: DoseItem[] = medications.flatMap((med) => {
    const doseCount = parseDoseCount(med.frequency);
    const times =
      med.alarm_enabled && Array.isArray(med.alarm_times) && med.alarm_times.length === doseCount
        ? med.alarm_times
        : null;
    return Array.from({ length: doseCount }, (_, di) => ({
      medId: med.id,
      doseIndex: di,
      time: times ? times[di] : null,
      hasTime: !!times,
      // 시각 없는 다회차 → "N회차"(기록장은 편집기와 맞춰 '회차' 유지). 시각 없는 1회차 → 빈도 힌트.
      ordinal: !times && doseCount > 1 ? t('record.form.doseNth', { n: di + 1 }) : null,
      freqHint: !times && doseCount === 1 ? (FREQ_LABEL_KEY[med.frequency] ? t(`record.dose.${FREQ_LABEL_KEY[med.frequency]}`) : med.frequency) : null,
      color: med.color || '#3B82F6',
      petName: med.pets?.name,
      medName: med.name,
    }));
  });
  // 시각 있는 회차(시간 오름차순) → 시각 없는 회차(맨 아래). 동률은 펫 → 약이름 → 회차 순 안정 정렬.
  doses.sort((a, b) => {
    if (a.hasTime !== b.hasTime) return a.hasTime ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    const p = (a.petName ?? '').localeCompare(b.petName ?? '');
    if (p) return p;
    const n = a.medName.localeCompare(b.medName);
    if (n) return n;
    return a.doseIndex - b.doseIndex;
  });

  const totalDoses = medications.reduce((sum, med) => sum + parseDoseCount(med.frequency), 0);
  const checkedCount = checks.filter((c) => c.checked).length;
  const pct = totalDoses ? Math.round((checkedCount / totalDoses) * 100) : 0;

  return (
    <div className={card ? 'bg-white rounded-2xl border border-gray-100 px-4 py-3' : 'px-4 py-3'}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Pill size={18} className="text-blue-600" />
          <h4 className="font-semibold text-sm text-gray-900">
            {(() => {
              const d = new Date();
              const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return today === localToday
                ? t('home.medWidget.title')
                : t('meds.datedTitle', { m: parseInt(today.split('-')[1]), d: parseInt(today.split('-')[2]) });
            })()}
          </h4>
        </div>
        <span className="text-xs text-gray-400">
          {t('meds.doneCount', { checked: checkedCount, total: totalDoses })}
        </span>
      </div>

      {/* 진행바 — 완료 비율(체크된 회차 / 전체 회차). 체크 색(초록)과 통일. */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2.5">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* 회차 단위 한 줄 시간표 — 체크 · 색점 · 시각 · 약이름 · 펫 (모든 줄 동일 형식) */}
      <div className="space-y-1.5">
        {doses.map((dose) => {
          const isChecked = checks.some(
            (c) => c.medication_id === dose.medId && c.dose_number === dose.doseIndex && c.checked
          );
          return (
            <button
              key={`${dose.medId}-${dose.doseIndex}`}
              onClick={() => handleToggle(dose.medId, dose.doseIndex)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors text-left ${
                isChecked
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-none transition-colors ${
                  isChecked ? 'bg-green-500 border-green-500 text-[#fff]' : 'border-gray-300'
                }`}
              >
                {isChecked && <Check size={12} />}
              </span>
              <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: dose.color }} />
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium truncate ${isChecked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                  {dose.time ? <span className="text-gray-400 font-normal tabular-nums">{dose.time} </span> : null}
                  {dose.medName}
                  {dose.ordinal ? <span className="text-gray-400 font-normal"> {dose.ordinal}</span> : null}
                  {dose.petName ? <span className="text-gray-400 font-normal"> · {dose.petName}</span> : null}
                  {dose.freqHint ? <span className="text-gray-400 font-normal"> · {dose.freqHint}</span> : null}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
