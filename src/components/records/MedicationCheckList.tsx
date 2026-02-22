'use client';

import { useState, useEffect } from 'react';
import { Pill, Check } from 'lucide-react';
import { useMedications } from '@/hooks/useMedications';
import { MedicationCheck } from '@/lib/supabase';

interface MedicationCheckListProps {
  petId?: string;
  date?: string;
}

const DOSE_LABELS: Record<number, string[]> = {
  1: ['복용'],
  2: ['아침', '저녁'],
  3: ['아침', '점심', '저녁'],
};

function parseDoseCount(frequency: string): number {
  if (frequency.includes('3회')) return 3;
  if (frequency.includes('2회')) return 2;
  return 1;
}

export function MedicationCheckList({ petId, date }: MedicationCheckListProps) {
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
      console.error('Error toggling check:', error);
    }
  };

  if (loading) {
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
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pill size={18} className="text-blue-600" />
          <h4 className="font-semibold text-sm text-gray-900">
            {(() => {
              const d = new Date();
              const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return today === localToday ? '오늘의 투약' : `${parseInt(today.split('-')[1])}/${parseInt(today.split('-')[2])} 투약`;
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
          const labels = DOSE_LABELS[doseCount] || DOSE_LABELS[1];
          const petName = med.health_records?.pets?.name;

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
