'use client';

import type { Pet } from '@/lib/supabase';

interface Props {
  pets: Pet[];
  value: string | null;              // 선택된 petId (null = 전체, showAll=true 일 때만 유의미)
  onChange: (petId: string | null) => void;
  showAll?: boolean;                 // "전체" 버튼 노출 여부 (default true — 목록/통계 용도)
  className?: string;
}

/**
 * 반려동물 선택 칩 리스트 — pure presentational 컴포넌트.
 *
 * - 가로 스크롤 chip 형태 (pill). 선택된 pet 은 파란 배경 + 흰 글자.
 * - pets 배열은 부모에서 fetch 해 내려줌 — 이 컴포넌트는 렌더링만 담당.
 * - 기록/수정 (`showAll={false}`) 에선 "전체" 버튼 숨김 → 반드시 1개 선택.
 * - 목록/통계 (`showAll={true}`) 에선 "전체" 로 모든 반려동물 필터 해제.
 */
export function PetChipList({ pets, value, onChange, showAll = true, className = '' }: Props) {
  if (pets.length === 0) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto hide-scrollbar ${className}`}>
      {showAll && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            value === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          전체
        </button>
      )}
      {pets.map((pet) => (
        <button
          key={pet.id}
          type="button"
          onClick={() => onChange(pet.id)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            value === pet.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          {pet.name}
          <span className="ml-1 text-[10px] opacity-70">
            {pet.type === 'dog' ? '강아지' : '고양이'}
          </span>
        </button>
      ))}
    </div>
  );
}
