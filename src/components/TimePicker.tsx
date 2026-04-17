'use client';

import { useState, useEffect } from 'react';

interface Props {
  value: string;           // "HH:MM" (24h format, e.g. "14:30")
  onChange: (v: string) => void;
  className?: string;
}

/**
 * AM/PM 토글 + 시/분 입력 시간 선택기.
 *
 * 내부: 12h 표시 (오전/오후 + 1~12시)
 * 입출력: 24h "HH:MM" 포맷 (DB/기존 코드 호환)
 *
 * 모바일 알람 설정 UI 참고:
 *   [오전|오후]  [HH] : [MM]
 */
export function TimePicker({ value, onChange, className = '' }: Props) {
  const parsed = parse24h(value);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);
  const [hour, setHour] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);

  // 외부 value 변경 시 동기화
  useEffect(() => {
    const p = parse24h(value);
    setAmpm(p.ampm);
    setHour(p.hour12);
    setMinute(p.minute);
  }, [value]);

  const emit = (a: 'AM' | 'PM', h: string, m: string) => {
    const h24 = to24h(a, h, m);
    onChange(h24);
  };

  const handleAmpm = (a: 'AM' | 'PM') => {
    setAmpm(a);
    emit(a, hour, minute);
  };

  const handleHour = (raw: string) => {
    // 1~12 만 허용
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 12)) {
      setHour(cleaned);
      if (cleaned && n >= 1 && n <= 12) emit(ampm, cleaned, minute);
    }
  };

  const handleMinute = (raw: string) => {
    // 0~59 만 허용
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 59)) {
      setMinute(cleaned);
      if (cleaned !== '') emit(ampm, hour, cleaned);
    }
  };

  // blur 시 패딩 보정
  const handleHourBlur = () => {
    let h = Number(hour) || 12;
    if (h < 1) h = 12;
    if (h > 12) h = 12;
    const padded = String(h);
    setHour(padded);
    emit(ampm, padded, minute);
  };

  const handleMinuteBlur = () => {
    let m = Number(minute) || 0;
    if (m > 59) m = 59;
    const padded = String(m).padStart(2, '0');
    setMinute(padded);
    emit(ampm, hour, padded);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* AM/PM 토글 */}
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

      {/* 시 */}
      <input
        type="text"
        inputMode="numeric"
        value={hour}
        onChange={(e) => handleHour(e.target.value)}
        onBlur={handleHourBlur}
        placeholder="12"
        className="w-12 text-center px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />

      <span className="text-gray-400 font-bold">:</span>

      {/* 분 */}
      <input
        type="text"
        inputMode="numeric"
        value={minute}
        onChange={(e) => handleMinute(e.target.value)}
        onBlur={handleMinuteBlur}
        placeholder="00"
        className="w-12 text-center px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
    </div>
  );
}

// ── helpers ──

function parse24h(v: string): { ampm: 'AM' | 'PM'; hour12: string; minute: string } {
  if (!v || !v.includes(':')) return { ampm: 'AM', hour12: '12', minute: '00' };
  const [hStr, mStr] = v.split(':');
  let h = Number(hStr) || 0;
  const m = String(Number(mStr) || 0).padStart(2, '0');
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { ampm, hour12: String(h), minute: m };
}

function to24h(ampm: 'AM' | 'PM', hourStr: string, minuteStr: string): string {
  let h = Number(hourStr) || 12;
  if (ampm === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  const m = Number(minuteStr) || 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
