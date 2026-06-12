'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Pill, Check } from 'lucide-react';
import { useMedications } from '@/hooks/useMedications';
import { MedicationCheck } from '@/lib/supabase';

interface MedicationCheckListProps {
  petId?: string;
  date?: string;
  card?: boolean;   // 홈에서 흰 카드로 감싸 노출 (복약 있을 때만 — 빈 경우 null 반환이라 카드도 안 뜸)
}

function getDoseLabels(med: { frequency: string; alarm_times?: string[] | null }): string[] {
  const count = parseDoseCount(med.frequency);
  const times = med.alarm_times;
  if (times && times.length === count) return times;
  if (count === 1) return ['복용'];
  return Array.from({ length: count }, (_, i) => `${i + 1}회차`);
}

function parseDoseCount(frequency: string): number {
  if (frequency.includes('3회')) return 3;
  if (frequency.includes('2회')) return 2;
  return 1;
}

export function MedicationCheckList({ petId, date, card }: MedicationCheckListProps) {
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

  // Total dose slots and checked count
  const totalDoses = medications.reduce((sum, med) => sum + parseDoseCount(med.frequency), 0);
  const checkedCount = checks.filter((c) => c.checked).length;

  return (
    <div className={card ? 'bg-white rounded-2xl border border-gray-100 px-4 py-3' : 'px-4 py-3'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pill size={18} className="text-blue-600" />
          <h4 className="font-semibold text-sm text-gray-900">
            {(() => {
              const d = new Date();
              const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return today === localToday ? '오늘의 약' : `${parseInt(today.split('-')[1])}/${parseInt(today.split('-')[2])} 약`;
            })()}
          </h4>
        </div>
        <span className="text-xs text-gray-400">
          {checkedCount}/{totalDoses} 완료
        </span>
      </div>

      <div className="space-y-2">
        {medications.map((med) => {
          const doseCount = parseDoseCount(med.frequency);
          const labels = getDoseLabels(med);
          const petName = med.pets?.name;

          return (
            <div key={med.id} className="space-y-1.5">
              {/* Medication name header (only if multi-dose) */}
              {doseCount > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: med.color || '#3B82F6' }} />
                  <span className="text-xs font-medium text-gray-500">
                    {med.name}
                    {med.dosage && ` ${med.dosage}`}
                    {petName && ` - ${petName}`}
                  </span>
                </div>
              )}
              {labels.map((label, doseIdx) => {
                const isChecked = checks.some(
                  (c) => c.medication_id === med.id && c.dose_number === doseIdx && c.checked
                );
                return (
                  <button
                    key={`${med.id}-${doseIdx}`}
                    onClick={() => handleToggle(med.id, doseIdx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      isChecked
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-green-500 border-green-500 text-[#fff]'
                          : 'border-gray-300'
                      }`}
                    >
                      {isChecked && <Check size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {doseCount === 1 ? (
                        <>
                          <p className={`text-sm font-medium ${isChecked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                            {med.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {med.dosage && `${med.dosage} `}
                            {med.frequency}
                            {petName && ` - ${petName}`}
                          </p>
                        </>
                      ) : (
                        <p className={`text-sm font-medium ${isChecked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                          {label}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
