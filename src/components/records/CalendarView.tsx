'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { HealthRecord } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  records: HealthRecord[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function CalendarView({ records, onDateSelect, selectedDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const recordDates = records.reduce<Record<string, HealthRecord[]>>((acc, record) => {
    const dateKey = record.visit_date.split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(record);
    return acc;
  }, {});

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const dayRecords = recordDates[selectedDateKey] || [];

  const typeIcon = {
    symptom: AlertCircle,
    visit: Stethoscope,
    manual: FileEdit,
  };

  const typeColor = {
    symptom: 'text-orange-500',
    visit: 'text-blue-500',
    manual: 'text-gray-500',
  };

  const typeLabel = {
    symptom: '증상',
    visit: '진료',
    manual: '기록',
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
          const hasRecords = !!recordDates[dateKey];
          const isSelected = isSameDay(d, selectedDate);
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const isTodayDate = isToday(d);
          const dayOfWeek = d.getDay();

          return (
            <button
              key={dateKey}
              onClick={() => onDateSelect(d)}
              className={`relative flex flex-col items-center justify-center h-11 rounded-xl transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isTodayDate
                  ? 'bg-blue-50 text-blue-600'
                  : isCurrentMonth
                  ? 'text-gray-800 hover:bg-gray-50'
                  : 'text-gray-300'
              }`}
            >
              <span
                className={`text-sm leading-none ${
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
                } ${isSelected ? '!text-white' : ''}`}
              >
                {d.getDate()}
              </span>
              {hasRecords && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-blue-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Records */}
      <div className="border-t border-gray-100 px-4 py-3">
        <h4 className="text-sm font-bold text-gray-800 mb-2">
          {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
        </h4>
        {dayRecords.length > 0 ? (
          <div className="space-y-2">
            {dayRecords.map((record) => {
              const Icon = typeIcon[record.record_type] || FileEdit;
              const color = typeColor[record.record_type] || 'text-gray-500';
              const label = typeLabel[record.record_type] || '기록';
              return (
                <div key={record.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    record.record_type === 'visit' ? 'bg-blue-100' :
                    record.record_type === 'symptom' ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${color}`}>{label}</span>
                      {record.hospital_name && (
                        <span className="text-xs text-gray-400">{record.hospital_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-2">기록이 없습니다</p>
        )}
      </div>
    </div>
  );
}
