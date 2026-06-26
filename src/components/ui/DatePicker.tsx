'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { DayPicker, type Matcher } from 'react-day-picker';
import { ko, enUS } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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
  placeholder,
  max,
  min,
  name,
  className = '',
  inputClassName = '',
}: DatePickerProps) {
  const t = useTranslations();
  const uiLocale = useLocale();
  const isEn = uiLocale === 'en';
  const ph = placeholder ?? t('common.selectDate');
  const monthLabel = (m: number) => isEn ? new Date(2000, m, 1).toLocaleDateString('en-US', { month: 'short' }) : `${m + 1}월`;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => parseYmd(value) || new Date());
  // 'day' 일반 달력 / 'year' 연도 그리드 / 'month' 월 그리드 (네이티브 select 대신 커스텀 패널)
  const [view, setView] = useState<'day' | 'year' | 'month'>('day');
  const modalRef = useRef<HTMLDivElement>(null);

  // 모달 열릴 때 현재 value 의 month 로 동기화 + 항상 day 뷰로 시작.
  useEffect(() => {
    if (open) {
      setMonth(parseYmd(value) || new Date());
      setView('day');
    }
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

  // 연도 그리드 목록 — 최근 연도가 위로 (descending). 생일은 아래로 스크롤해 선택.
  const years: number[] = [];
  for (let y = endMonth.getFullYear(); y >= startMonth.getFullYear(); y--) years.push(y);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        name={name}
        className={`w-full text-left flex items-center justify-between ${inputClassName || 'px-3 py-2.5 border border-gray-200 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || ph}
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
            {/* 커스텀 헤더 — [‹] [연도 칩][월 칩] [›].
                  연/월 칩을 누르면 모달 안 그리드로 전환(네이티브 select 미사용 → OS 전체화면 목록 X). */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label={t('calendar.prevMonth')}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setView(view === 'year' ? 'day' : 'year')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'year' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {isEn ? month.getFullYear() : `${month.getFullYear()}년`}
                </button>
                <button
                  type="button"
                  onClick={() => setView(view === 'month' ? 'day' : 'month')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === 'month' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {monthLabel(month.getMonth())}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label={t('calendar.nextMonth')}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {view === 'year' ? (
              <div className="grid grid-cols-4 gap-1.5 max-h-[244px] overflow-y-auto py-1">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { setMonth(new Date(y, month.getMonth(), 1)); setView('day'); }}
                    className={`py-2.5 rounded-lg text-sm transition-colors ${y === month.getFullYear() ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : view === 'month' ? (
              <div className="grid grid-cols-4 gap-1.5 py-1">
                {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMonth(new Date(month.getFullYear(), m, 1)); setView('day'); }}
                    className={`py-2.5 rounded-lg text-sm transition-colors ${m === month.getMonth() ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
            ) : (
              <DayPicker
                mode="single"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                hideNavigation
                onSelect={(d) => {
                  if (d) {
                    onChange(toYmd(d));
                    setOpen(false);
                  }
                }}
                locale={isEn ? enUS : ko}
                disabled={disabled.length > 0 ? disabled : undefined}
                showOutsideDays
                className="pawdex-dp"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
