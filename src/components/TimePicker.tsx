'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  value: string;           // "HH:MM" (24h format)
  onChange: (v: string) => void;
  minuteStep?: number;     // 분 단위 (기본 1, 투약용 15)
  className?: string;
}

/**
 * AM/PM + 시 + 분 picker.
 * - 시/분 각각 입력 가능 + 증감 버튼 (위/아래)
 * - minuteStep=15 면 분은 0/15/30/45 만
 */
export function TimePicker({ value, onChange, minuteStep = 1, className = '' }: Props) {
  const parsed = parse24h(value);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);
  const [hour, setHour] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);

  useEffect(() => {
    const p = parse24h(value);
    setAmpm(p.ampm);
    setHour(p.hour12);
    setMinute(p.minute);
  }, [value]);

  const emit = (a: 'AM' | 'PM', h: string, m: string) => {
    onChange(to24h(a, h, m));
  };

  const bumpHour = (delta: number) => {
    let h = (Number(hour) || 12) + delta;
    if (h < 1) h = 12;
    if (h > 12) h = 1;
    const v = String(h);
    setHour(v);
    emit(ampm, v, minute);
  };

  const bumpMinute = (delta: number) => {
    const step = minuteStep;
    let m = (Number(minute) || 0) + delta * step;
    if (m < 0) m = 60 - step;
    if (m >= 60) m = 0;
    const v = String(m).padStart(2, '0');
    setMinute(v);
    emit(ampm, hour, v);
  };

  const handleHour = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 12)) {
      setHour(cleaned);
      if (cleaned && n >= 1 && n <= 12) emit(ampm, cleaned, minute);
    }
  };

  const handleMinute = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 59)) {
      setMinute(cleaned);
      if (cleaned !== '') emit(ampm, hour, cleaned);
    }
  };

  const handleHourBlur = () => {
    let h = Number(hour) || 12;
    if (h < 1) h = 12;
    if (h > 12) h = 12;
    setHour(String(h));
    emit(ampm, String(h), minute);
  };

  const handleMinuteBlur = () => {
    let m = Number(minute) || 0;
    if (m > 59) m = 59;
    // minuteStep 에 맞게 반올림
    if (minuteStep > 1) m = Math.round(m / minuteStep) * minuteStep;
    if (m >= 60) m = 60 - minuteStep;
    const v = String(m).padStart(2, '0');
    setMinute(v);
    emit(ampm, hour, v);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* AM/PM */}
      <div className="flex bg-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => { setAmpm('AM'); emit('AM', hour, minute); }}
          className={`px-3 py-2 text-xs font-medium ${ampm === 'AM' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
        >
          오전
        </button>
        <button
          type="button"
          onClick={() => { setAmpm('PM'); emit('PM', hour, minute); }}
          className={`px-3 py-2 text-xs font-medium ${ampm === 'PM' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
        >
          오후
        </button>
      </div>

      {/* 시 */}
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => bumpHour(1)} className="p-0.5 text-gray-400 hover:text-blue-600">
          <ChevronUp size={14} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={hour}
          onChange={(e) => handleHour(e.target.value)}
          onBlur={handleHourBlur}
          placeholder="12"
          className="w-12 text-center py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button type="button" onClick={() => bumpHour(-1)} className="p-0.5 text-gray-400 hover:text-blue-600">
          <ChevronDown size={14} />
        </button>
      </div>

      <span className="text-gray-400 font-bold">:</span>

      {/* 분 */}
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => bumpMinute(1)} className="p-0.5 text-gray-400 hover:text-blue-600">
          <ChevronUp size={14} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={(e) => handleMinute(e.target.value)}
          onBlur={handleMinuteBlur}
          placeholder="00"
          className="w-12 text-center py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button type="button" onClick={() => bumpMinute(-1)} className="p-0.5 text-gray-400 hover:text-blue-600">
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}

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
  const m = Number(minuteStr) || 0;
  if (ampm === 'AM') { if (h === 12) h = 0; }
  else { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
