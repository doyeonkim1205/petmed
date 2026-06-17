'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';
import type { Pet } from '@/lib/supabase';

interface Props {
  pets: Pet[];
  value: string;                    // 선택된 petId. '' = 미선택
  onChange: (petId: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 반려동물 선택 드롭다운 — TimePicker 분 선택과 동일한 커스텀 popover 패턴.
 *
 * - 트리거 버튼: 현재 선택된 반려동물 이름 + 종 서브라벨
 * - 열었을 때: 전체 반려동물 리스트 (체크 아이콘으로 선택 표시)
 * - 닫기: 옵션 선택 / 트리거 재탭 / 바깥 탭 / Escape
 * - 반려동물 많아져도 스크롤 (max-h-64 overflow-y-auto) — 스케일 OK.
 */
export function PetSelectDropdown({
  pets,
  value,
  onChange,
  placeholder,
  className = '',
}: Props) {
  const t = useTranslations();
  const ph = placeholder ?? t('common.selectPet');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = pets.find((p) => p.id === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border border-gray-200 rounded-lg bg-white text-sm hover:border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        {selected ? (
          <span className="text-gray-800">{selected.name}</span>
        ) : (
          <span className="text-gray-400">{ph}</span>
        )}
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 max-h-64 overflow-y-auto"
        >
          {pets.map((pet) => {
            const isSelected = pet.id === value;
            return (
              <button
                key={pet.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(pet.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-3 text-sm flex items-center justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{pet.name}</span>
                {isSelected && <Check size={16} className="text-blue-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
