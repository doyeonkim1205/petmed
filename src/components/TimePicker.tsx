'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  value: string;           // "HH:MM" (24h format)
  onChange: (v: string) => void;
  minuteStep?: number;     // 분 단위 (기본 1 = 자유 입력, 15 = 투약 프리셋 버튼)
  className?: string;
}

/**
 * AM/PM + 시 + 분 picker.
 *
 * 모드:
 *   - minuteStep=1 (기본): 분 자유 입력.
 *   - minuteStep=15: 분은 [00][15][30][45] 프리셋 버튼 그리드.
 *     투약 스케줄은 "15분 간격" 규칙이 많아서 자유 입력 대신 버튼.
 *
 * 편집 중 부모 value round-trip 방지:
 *   - 타이핑 중엔 emit 안 함 (blur 시에만 부모에 반영).
 *   - 이전엔 매 keystroke 마다 emit → 부모가 "HH:0X" 로 zero-pad 해서
 *     돌려줌 → useEffect 가 로컬 state 를 덮어씀 → 두번째 숫자가
 *     먹히지 않고 커서도 엉키는 버그가 있었음.
 *   - blur / 증감 버튼 / AM-PM 토글에서만 emit 하도록 분리.
 */
export function TimePicker({ value, onChange, minuteStep = 1, className = '' }: Props) {
  const parsed = parse24h(value);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);
  const [hour, setHour] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);

  // "입력창 포커스 중" 을 추적 — 이 동안엔 부모 value 변화를 무시.
  // 안 그러면 emit 안 해도 부모의 다른 상태 변화로 value prop 이 재계산되어
  // 로컬을 덮어쓰는 엣지 케이스가 생김.
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
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

  // 타이핑 중엔 emit 안 함 (round-trip 차단). blur 에서만 emit.
  const handleHour = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 12)) {
      setHour(cleaned);
    }
  };

  const handleMinute = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    const n = Number(cleaned);
    if (cleaned === '' || (n >= 0 && n <= 59)) {
      setMinute(cleaned);
    }
  };

  const handleHourBlur = () => {
    editingRef.current = false;
    let h = Number(hour) || 12;
    if (h < 1) h = 12;
    if (h > 12) h = 12;
    const v = String(h);
    setHour(v);
    emit(ampm, v, minute);
  };

  const handleMinuteBlur = () => {
    editingRef.current = false;
    let m = Number(minute) || 0;
    if (m > 59) m = 59;
    // minuteStep 에 맞게 반올림 (minuteStep=1 이면 그대로)
    if (minuteStep > 1) m = Math.round(m / minuteStep) * minuteStep;
    if (m >= 60) m = 60 - minuteStep;
    const v = String(m).padStart(2, '0');
    setMinute(v);
    emit(ampm, hour, v);
  };

  const pickMinutePreset = (m: number) => {
    const v = String(m).padStart(2, '0');
    setMinute(v);
    emit(ampm, hour, v);
  };

  const isSteppedPreset = minuteStep === 15;

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
          onFocus={() => { editingRef.current = true; }}
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

      {/* 분: 기본은 입력, 투약(step=15)은 프리셋 버튼 */}
      {isSteppedPreset ? (
        <div className="grid grid-cols-2 gap-1">
          {[0, 15, 30, 45].map((m) => {
            const mStr = String(m).padStart(2, '0');
            const selected = minute === mStr;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pickMinutePreset(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mStr}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => bumpMinute(1)} className="p-0.5 text-gray-400 hover:text-blue-600">
            <ChevronUp size={14} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={minute}
            onFocus={() => { editingRef.current = true; }}
            onChange={(e) => handleMinute(e.target.value)}
            onBlur={handleMinuteBlur}
            placeholder="00"
            className="w-12 text-center py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button type="button" onClick={() => bumpMinute(-1)} className="p-0.5 text-gray-400 hover:text-blue-600">
            <ChevronDown size={14} />
          </button>
        </div>
      )}
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
