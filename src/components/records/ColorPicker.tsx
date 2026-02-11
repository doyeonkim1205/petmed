'use client';

import { Check } from 'lucide-react';

const PRESET_COLORS = [
  { hex: '#EF4444', label: '빨강' },
  { hex: '#F97316', label: '주황' },
  { hex: '#EAB308', label: '노랑' },
  { hex: '#22C55E', label: '초록' },
  { hex: '#3B82F6', label: '파랑' },
  { hex: '#8B5CF6', label: '보라' },
  { hex: '#EC4899', label: '분홍' },
  { hex: '#6B7280', label: '회색' },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex gap-2">
        {PRESET_COLORS.map(({ hex }) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ring-offset-1"
            style={{
              backgroundColor: hex,
              boxShadow: value === hex ? `0 0 0 2px white, 0 0 0 3.5px ${hex}` : 'none',
            }}
          >
            {value === hex && <Check size={14} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}
