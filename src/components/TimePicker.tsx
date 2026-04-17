'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  value: string;           // "HH:MM" (24h format, e.g. "14:30")
  onChange: (v: string) => void;
  className?: string;
}

/**
 * AM/PM 토글 + 단일 시:분 입력 시간 선택기.
 *
 * [오전|오후]  [12:30]
 *
 * 내부 12h 표시, 입출력은 24h "HH:MM".
 */
export function TimePicker({ value, onChange, className = '' }: Props) {
  const parsed = parse24h(value);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);
  const [display, setDisplay] = useState(parsed.display);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = parse24h(value);
    setAmpm(p.ampm);
    setDisplay(p.display);
  }, [value]);

  const emit = (a: 'AM' | 'PM', disp: string) => {
    const h24 = displayTo24h(a, disp);
    if (h24) onChange(h24);
  };

  const handleAmpm = (a: 'AM' | 'PM') => {
    setAmpm(a);
    emit(a, display);
  };

  const handleInput = (raw: string) => {
    // 숫자만 추출 (콜론 포함 모든 비숫자 제거)
    const digits = raw.replace(/\D/g, '').slice(0, 4);

    // 자동 콜론 삽입: 3자리 이상이면 뒤 2자리 앞에 콜론
    let formatted: string;
    if (digits.length <= 2) {
      formatted = digits;
    } else {
      formatted = digits.slice(0, digits.length - 2) + ':' + digits.slice(-2);
    }

    setDisplay(formatted);

    if (/^\d{1,2}:\d{2}$/.test(formatted)) {
      emit(ampm, formatted);
    }
  };

  const handleBlur = () => {
    // blur 시 보정: 빈 값이면 기본값, 불완전이면 완성
    if (!display || display === ':') {
      setDisplay('12:00');
      emit(ampm, '12:00');
      return;
    }

    const parts = display.split(':');
    let h = Math.min(Math.max(Number(parts[0]) || 12, 1), 12);
    let m = Math.min(Number(parts[1]) || 0, 59);
    const fixed = `${h}:${String(m).padStart(2, '0')}`;
    setDisplay(fixed);
    emit(ampm, fixed);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex bg-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => handleAmpm('AM')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            ampm === 'AM' ? 'bg-blue-600 text-white' : 'text-gray-500'
          }`}
        >
          오전
        </button>
        <button
          type="button"
          onClick={() => handleAmpm('PM')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            ampm === 'PM' ? 'bg-blue-600 text-white' : 'text-gray-500'
          }`}
        >
          오후
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={handleBlur}
        placeholder="12:00"
        className="w-20 text-center px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
    </div>
  );
}

function parse24h(v: string): { ampm: 'AM' | 'PM'; display: string } {
  if (!v || !v.includes(':')) return { ampm: 'AM', display: '12:00' };
  const [hStr, mStr] = v.split(':');
  let h = Number(hStr) || 0;
  const m = String(Number(mStr) || 0).padStart(2, '0');
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { ampm, display: `${h}:${m}` };
}

function displayTo24h(ampm: 'AM' | 'PM', disp: string): string | null {
  if (!disp || !disp.includes(':')) return null;
  const [hStr, mStr] = disp.split(':');
  let h = Number(hStr) || 12;
  const m = Number(mStr) || 0;
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (ampm === 'AM') { if (h === 12) h = 0; }
  else { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
