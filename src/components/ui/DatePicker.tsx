'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import 'react-day-picker/style.css';

interface DatePickerProps {
  value: string;          // YYYY-MM-DD (빈 문자열이면 미선택)
  onChange: (value: string) => void;
  placeholder?: string;
  /** YYYY-MM-DD, 이 날짜 초과 선택 불가 (예: 미래 차단) */
  max?: string;
  /** YYYY-MM-DD, 이 날짜 미만 선택 불가 (예: 입원일 이전 차단) */
  min?: string;
  name?: string;
  className?: string;
  /** input 자체 클래스 (border / padding 등 외부 컨테이너와 통일용) */
  inputClassName?: string;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date | undefined {
  if (!s) return undefined;
  // YYYY-MM-DD 또는 ISO. 시간대 안전 위해 local 파싱.
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function DatePicker({
  value,
  onChange,
  placeholder = '날짜 선택',
  max,
  min,
  name,
  className = '',
  inputClassName = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const selected = parseYmd(value);
  const maxDate = parseYmd(max || '');
  const minDate = parseYmd(min || '');

  const disabled: Matcher[] = [];
  if (maxDate) disabled.push({ after: maxDate });
  if (minDate) disabled.push({ before: minDate });

  const display = value || '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        name={name}
        className={`w-full text-left flex items-center justify-between ${inputClassName || 'px-4 py-3 border border-gray-200 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {display || placeholder}
        </span>
        <Calendar size={16} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 p-2"
          style={{ minWidth: 280 }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toYmd(d));
                setOpen(false);
              }
            }}
            locale={ko}
            disabled={disabled.length > 0 ? disabled : undefined}
            showOutsideDays
            classNames={{
              root: 'pawdex-day-picker',
              caption_label: 'text-sm font-semibold text-gray-800',
              nav_button: 'p-1.5 hover:bg-gray-100 rounded-lg',
              weekday: 'text-[10px] font-medium text-gray-400 py-1',
              day: 'rounded-full text-sm hover:bg-blue-50 transition-colors aspect-square w-9 inline-flex items-center justify-center',
              selected: 'bg-blue-600 text-white hover:bg-blue-700',
              today: 'font-bold text-blue-600',
              outside: 'text-gray-300',
              disabled: 'text-gray-300 cursor-not-allowed hover:bg-transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}
