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
  const [month, setMonth] = useState<Date>(() => parseYmd(value) || new Date());
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 열릴 때 현재 value 의 month 로 동기화.
  useEffect(() => {
    if (open) setMonth(parseYmd(value) || new Date());
  }, [open, value]);

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

  // 연/월 드롭다운 범위 — 나이 많은 반려동물 생일도 연도 점프 한 번으로 선택.
  //   start = min연도(있으면) / 없으면 올해-30, end = max연도(있으면) / 없으면 올해+5.
  //   (생일=과거 / 다음 예약=미래 양쪽 모두 커버)
  const nowYear = new Date().getFullYear();
  const startMonth = new Date(minDate ? minDate.getFullYear() : nowYear - 30, 0, 1);
  const endMonth = new Date(maxDate ? maxDate.getFullYear() : nowYear + 5, 11, 31);

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
            {/* 연/월 드롭다운 caption (captionLayout="dropdown") + 이전/다음 달 화살표.
                  연도를 드롭다운에서 바로 골라 점프 → 나이 많은 반려동물 생일도 한 번에. */}
            <DayPicker
              mode="single"
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              selected={selected}
              month={month}
              onMonthChange={setMonth}
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
