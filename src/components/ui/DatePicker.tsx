'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';
import 'react-day-picker/style.css';

interface DatePickerProps {
  value: string;          // YYYY-MM-DD (빈 문자열이면 미선택)
  onChange: (value: string) => void;
  placeholder?: string;
  /** YYYY-MM-DD, 이 날짜 초과 선택 불가 (예: 미래 차단) */
  max?: string;
  /** YYYY-MM-DD, 이 날짜 미만 선택 불가 */
  min?: string;
  name?: string;
  /** wrapper div 클래스 */
  className?: string;
  /** input 자체 클래스 (border / padding 등) */
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
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 열렸을 때 body 스크롤 lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selected = parseYmd(value);
  const maxDate = parseYmd(max || '');
  const minDate = parseYmd(min || '');

  const disabled: Matcher[] = [];
  if (maxDate) disabled.push({ after: maxDate });
  if (minDate) disabled.push({ before: minDate });

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        name={name}
        className={`w-full text-left flex items-center justify-between ${inputClassName || 'px-4 py-3 border border-gray-200 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <Calendar size={16} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-[320px] max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-sm font-semibold text-gray-700">날짜 선택</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-gray-300 hover:text-gray-500"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
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
              className="pawdex-dp"
            />
          </div>
        </div>
      )}
    </div>
  );
}
