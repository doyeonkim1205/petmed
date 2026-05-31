'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { HealthRecord } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit, Building2, ChevronLeft, ChevronRight, Pill, Calendar } from 'lucide-react';

interface CalendarViewProps {
  records: HealthRecord[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onRecordClick?: (recordId: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function CalendarView({ records, onDateSelect, selectedDate, onRecordClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  // Build dot map, appointment dates, medication map, and hospitalization range map
  const { dotMap, appointmentDates, medicationMap, hospMap } = useMemo(() => {
    const dots: Record<string, string[]> = {};
    const appointments = new Map<string, string>(); // dateKey → color
    const medMap: Record<string, { name: string; dosage?: string; frequency: string; color: string; recordId: string }[]> = {};
    const hosp: Record<string, { color: string; roundLeft: boolean; roundRight: boolean }> = {};

    const addDot = (dateKey: string, color: string) => {
      if (!dots[dateKey]) dots[dateKey] = [];
      if (!dots[dateKey].includes(color) && dots[dateKey].length < 4) {
        dots[dateKey].push(color);
      }
    };

    const addMed = (dateKey: string, med: { name: string; dosage?: string; frequency: string; color: string; recordId: string }) => {
      if (!medMap[dateKey]) medMap[dateKey] = [];
      medMap[dateKey].push(med);
    };

    for (const record of records) {
      // Record visit_date dot (non-hospitalization only; hospitalization uses bar)
      const visitKey = record.visit_date.split('T')[0];
      const recordColor = record.color || '#3B82F6';

      if (record.record_type === 'hospitalization') {
        // Build hospitalization range bar
        const startDate = new Date(visitKey);
        const endDate = record.discharge_date
          ? new Date(record.discharge_date.split('T')[0])
          : new Date(); // 입원 중이면 오늘까지
        const barColor = recordColor;

        let d = new Date(startDate);
        while (d <= endDate) {
          const dateKey = format(d, 'yyyy-MM-dd');
          const isStart = isSameDay(d, startDate);
          const isEnd = isSameDay(d, endDate);
          const dayOfWeek = d.getDay();
          const isRowStart = dayOfWeek === 0;
          const isRowEnd = dayOfWeek === 6;

          hosp[dateKey] = {
            color: barColor,
            roundLeft: isStart || isRowStart,
            roundRight: isEnd || isRowEnd,
          };
          d = addDays(d, 1);
        }
      } else {
        addDot(visitKey, recordColor);
      }

      // Next appointment date with its own color (future only)
      if (record.next_appointment_date) {
        const apptDate = new Date(record.next_appointment_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (apptDate >= today) {
          const apptKey = record.next_appointment_date.split('T')[0];
          const apptColor = record.next_appointment_color || '#8B5CF6';
          appointments.set(apptKey, apptColor);
        }
      }

      // Medications: spread across date range
      if (record.medications) {
        for (const med of record.medications) {
          const medColor = med.color || '#EC4899';
          const start = new Date(med.start_date);
          const end = med.end_date ? new Date(med.end_date) : addDays(start, 90);
          const maxEnd = addDays(start, 365); // safety limit
          const actualEnd = end < maxEnd ? end : maxEnd;

          let d = start;
          while (d <= actualEnd) {
            const dateKey = format(d, 'yyyy-MM-dd');
            addDot(dateKey, medColor);
            addMed(dateKey, { name: med.name, dosage: med.dosage, frequency: med.frequency, color: medColor, recordId: record.id });
            d = addDays(d, 1);
          }
        }
      }
    }

    return { dotMap: dots, appointmentDates: appointments, medicationMap: medMap, hospMap: hosp };
  }, [records]);

  // Build record map for selected date details
  const recordDates = useMemo(() => {
    return records.reduce<Record<string, HealthRecord[]>>((acc, record) => {
      const dateKey = record.visit_date.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);
      return acc;
    }, {});
  }, [records]);

  // Appointment records for a given date (all dates, for detail view)
  const appointmentRecords = useMemo(() => {
    const map: Record<string, HealthRecord[]> = {};
    for (const record of records) {
      if (record.next_appointment_date) {
        const key = record.next_appointment_date.split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(record);
      }
    }
    return map;
  }, [records]);

  // Discharge records for a given date
  const dischargeRecords = useMemo(() => {
    const map: Record<string, HealthRecord[]> = {};
    for (const record of records) {
      if (record.discharge_date) {
        const key = record.discharge_date.split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(record);
      }
    }
    return map;
  }, [records]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const dayRecords = recordDates[selectedDateKey] || [];
  const dayMedications = medicationMap[selectedDateKey] || [];
  const dayAppointments = appointmentRecords[selectedDateKey] || [];
  const dayDischarges = dischargeRecords[selectedDateKey] || [];

  // daily 는 캘린더 노출 X — 일상은 빈도 높은 메모성 기록이라 캘린더에 표시하면
  // 정작 중요한 진료/예약 이벤트가 묻혀버림. 호출부(records/page.tsx)에서 records
  // prop 에 daily 제외 필터 걸어두면 여기 매핑은 사용되지 않지만, 타입 안전을 위해
  // 일단 정의는 해둠.
  const typeIcon = {
    symptom: AlertCircle,
    visit: Stethoscope,
    hospitalization: Building2,
    manual: FileEdit,
    daily: FileEdit,
  };

  const typeColor = {
    symptom: 'text-orange-500',
    visit: 'text-blue-500',
    hospitalization: 'text-emerald-500',
    manual: 'text-gray-500',
    daily: 'text-[#2c0a71]',
  };

  const typeLabel = {
    symptom: '증상',
    visit: '진료',
    hospitalization: '입원',
    manual: '기록',
    daily: '일상',
  };

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-base font-bold text-gray-900">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 px-3">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className={`text-center text-xs font-semibold py-2 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 px-3 pb-3">
        {days.map((d) => {
          const dateKey = format(d, 'yyyy-MM-dd');
          const dots = dotMap[dateKey] || [];
          const appointmentColor = appointmentDates.get(dateKey);
          const isAppointment = !!appointmentColor;
          const isSelected = isSameDay(d, selectedDate);
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const isTodayDate = isToday(d);
          const dayOfWeek = d.getDay();
          const hospInfo = hospMap[dateKey];

          return (
            <button
              key={dateKey}
              onClick={() => onDateSelect(d)}
              className={`relative flex flex-col items-center justify-center h-11 transition-all ${
                hospInfo ? '' : 'rounded-xl'
              } ${
                isSelected
                  ? hospInfo ? 'text-[#fff]' : 'bg-blue-600 text-[#fff]'
                  : isTodayDate
                  ? 'bg-blue-50 text-blue-600'
                  : isCurrentMonth
                  ? 'text-gray-800 hover:bg-gray-50'
                  : 'text-gray-300'
              }`}
              style={isAppointment && !isSelected ? { outline: `2px dashed ${appointmentColor}`, outlineOffset: '-2px', borderRadius: '12px' } : undefined}
            >
              {/* Hospitalization bar */}
              {hospInfo && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: isSelected ? '#2563EB' : `${hospInfo.color}20`,
                    borderTopLeftRadius: hospInfo.roundLeft ? '8px' : '0',
                    borderBottomLeftRadius: hospInfo.roundLeft ? '8px' : '0',
                    borderTopRightRadius: hospInfo.roundRight ? '8px' : '0',
                    borderBottomRightRadius: hospInfo.roundRight ? '8px' : '0',
                  }}
                />
              )}
              <span
                className={`relative z-10 text-sm leading-none ${
                  isSelected
                    ? 'font-bold'
                    : isTodayDate
                    ? 'font-bold'
                    : !isCurrentMonth
                    ? ''
                    : dayOfWeek === 0
                    ? 'text-red-500'
                    : dayOfWeek === 6
                    ? 'text-blue-500'
                    : ''
                } ${isSelected ? '!text-[#fff]' : ''}`}
              >
                {d.getDate()}
              </span>
              {/* Multi-color dots */}
              {dots.length > 0 && (
                <div className="absolute bottom-0.5 flex gap-[2px] z-10">
                  {dots.slice(0, 4).map((color, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Details */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
        <h4 className="text-sm font-bold text-gray-800 mb-2">
          {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
        </h4>

        {/* Records */}
        {dayRecords.length > 0 && (
          <div className="space-y-2 mb-3">
            {dayRecords.map((record) => {
              const Icon = typeIcon[record.record_type] || FileEdit;
              const color = typeColor[record.record_type] || 'text-gray-500';
              const label = typeLabel[record.record_type] || '기록';
              return (
                <button
                  key={record.id}
                  onClick={() => onRecordClick?.(record.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    record.record_type === 'visit' ? 'bg-blue-100' :
                    record.record_type === 'symptom' ? 'bg-orange-100' :
                    record.record_type === 'hospitalization' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {record.color && (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: record.color }} />
                      )}
                      <p className="text-sm font-medium text-gray-900 truncate">{record.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${color}`}>{label}</span>
                      {record.hospital_name && (
                        <span className="text-xs text-gray-400">{record.hospital_name}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Medications */}
        {dayMedications.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <Pill size={12} /> 투약 중
            </p>
            <div className="space-y-1.5">
              {dayMedications.map((med, i) => (
                <button key={i} onClick={() => onRecordClick?.(med.recordId)} className="w-full flex items-center gap-2 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: med.color }} />
                  <span className="text-sm font-medium text-gray-800">{med.name}</span>
                  {med.dosage && <span className="text-xs text-gray-500">{med.dosage}</span>}
                  <span className="text-xs text-gray-400">{med.frequency}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Appointments */}
        {dayAppointments.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <Calendar size={12} /> 예약
            </p>
            <div className="space-y-1.5">
              {dayAppointments.map((record) => {
                const apptColor = record.next_appointment_color || '#8B5CF6';
                return (
                <button key={record.id} onClick={() => onRecordClick?.(record.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:opacity-80 transition-opacity text-left" style={{ backgroundColor: apptColor + '18' }}>
                  <Calendar size={14} style={{ color: apptColor }} />
                  <span className="text-sm font-medium text-gray-800">{record.title}</span>
                  {record.hospital_name && (
                    <span className="text-xs text-gray-400">{record.hospital_name}</span>
                  )}
                </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Discharges */}
        {dayDischarges.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <Building2 size={12} /> 퇴원
            </p>
            <div className="space-y-1.5">
              {dayDischarges.map((record) => (
                <button key={record.id} onClick={() => onRecordClick?.(record.id)} className="w-full flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-left">
                  <Building2 size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-800">{record.title}</span>
                  {record.hospital_name && (
                    <span className="text-xs text-gray-400">{record.hospital_name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {dayRecords.length === 0 && dayMedications.length === 0 && dayAppointments.length === 0 && dayDischarges.length === 0 && (
          <p className="text-sm text-gray-400 py-2">기록이 없습니다</p>
        )}
      </div>
    </div>
  );
}
