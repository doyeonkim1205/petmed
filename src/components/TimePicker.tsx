'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';

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

  // 분 커스텀 드롭다운 (minuteStep=15 일 때만 사용)
  const [minuteOpen, setMinuteOpen] = useState(false);
  const minuteTriggerRef = useRef<HTMLButtonElement>(null);
  const minutePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!minuteOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (minuteTriggerRef.current?.contains(t)) return;
      if (minutePanelRef.current?.contains(t)) return;
      setMinuteOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMinuteOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [minuteOpen]);

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

      {/* 분: 기본은 입력, 투약(step=15)은 커스텀 드롭다운 (네이티브 select 전체화면 휠 UX 회피) */}
      {isSteppedPreset ? (
        <div className="relative">
          <button
            ref={minuteTriggerRef}
            type="button"
            onClick={() => setMinuteOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={minuteOpen}
            className="flex items-center gap-1 py-1.5 pl-3 pr-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none min-w-[60px] justify-between cursor-pointer"
          >
            <span className="font-medium tabular-nums text-gray-800">{minute}</span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${minuteOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {minuteOpen && (
            <div
              ref={minutePanelRef}
              role="listbox"
              className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-full animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {[0, 15, 30, 45].map((m) => {
                const mStr = String(m).padStart(2, '0');
                const selected = mStr === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      pickMinutePreset(m);
                      setMinuteOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-sm flex items-center justify-between gap-3 tabular-nums transition-colors ${
                      selected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{mStr}</span>
                    {selected && <Check size={14} className="text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
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
