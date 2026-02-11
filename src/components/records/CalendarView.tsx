'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { HealthRecord } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit } from 'lucide-react';
import 'react-day-picker/style.css';

interface CalendarViewProps {
  records: HealthRecord[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

export function CalendarView({ records, onDateSelect, selectedDate }: CalendarViewProps) {
  const recordDates = records.reduce<Record<string, HealthRecord[]>>((acc, record) => {
    const dateKey = record.visit_date.split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(record);
    return acc;
  }, {});

  const modifiers = {
    hasRecord: Object.keys(recordDates).map((d) => new Date(d + 'T00:00:00')),
  };

  const modifiersStyles = {
    hasRecord: {
      fontWeight: 'bold' as const,
    },
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const dayRecords = recordDates[selectedDateKey] || [];

  const typeIcon = {
    symptom: AlertCircle,
    visit: Stethoscope,
    manual: FileEdit,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateSelect(date)}
          locale={ko}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          classNames={{
            today: 'text-blue-600 font-bold',
            selected: 'bg-blue-600 text-white rounded-full',
            root: 'w-full',
            month_caption: 'text-center font-bold text-lg mb-2',
            day: 'relative',
          }}
          components={{
            DayButton: ({ day, ...props }) => {
              const dateKey = format(day.date, 'yyyy-MM-dd');
              const hasRecords = !!recordDates[dateKey];
              return (
                <button {...props} className={props.className}>
                  {day.date.getDate()}
                  {hasRecords && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            },
          }}
        />
      </div>

      {dayRecords.length > 0 && (
        <div className="px-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            {format(selectedDate, 'M월 d일')} 기록
          </h4>
          {dayRecords.map((record) => {
            const Icon = typeIcon[record.record_type] || FileEdit;
            return (
              <div key={record.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon size={16} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{record.title}</p>
                  {record.hospital_name && (
                    <p className="text-xs text-gray-400">{record.hospital_name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
