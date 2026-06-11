'use client';

import { useState } from 'react';
import { ChevronDown, Lock, Check } from 'lucide-react';

type Opt = { id: string; label: string };

/**
 * 기간 선택 드롭다운 (건강 통계·의료비 공용).
 * 잠긴 기간(Free 한도 초과)은 자물쇠로 표시하고 누르면 onLocked(업셀).
 */
export function PeriodDropdown({
  value,
  options,
  lockedOptions,
  onChange,
  onLocked,
}: {
  value: string;
  options: Opt[];
  lockedOptions: Opt[];
  onChange: (id: string) => void;
  onLocked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) || lockedOptions.find((o) => o.id === value);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
      >
        <span className="text-gray-400 text-xs">기간</span>
        <span className="font-medium text-gray-700">{current?.label || '선택'}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[44px] z-40 w-36 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                <span className={value === o.id ? 'text-blue-600 font-medium' : 'text-gray-700'}>{o.label}</span>
                {value === o.id && <Check size={14} className="text-blue-600" />}
              </button>
            ))}
            {lockedOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => { onLocked(); setOpen(false); }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-300"
              >
                <span>{o.label}</span>
                <Lock size={12} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
