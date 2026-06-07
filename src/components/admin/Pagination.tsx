'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Admin 공용 번호 페이지네이션.
 *  - 한 번에 최대 10개 페이지 번호 (블록 단위). 블록 넘으면 … 으로 이동.
 *  - 양끝 prev/next 화살표.
 * totalPages <= 1 이면 렌더 안 함.
 */
const BLOCK = 10;

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const blockStart = Math.floor((page - 1) / BLOCK) * BLOCK + 1;
  const blockEnd = Math.min(blockStart + BLOCK - 1, totalPages);
  const nums: number[] = [];
  for (let i = blockStart; i <= blockEnd; i++) nums.push(i);

  const btn = 'min-w-8 h-8 px-2 rounded-md text-sm flex items-center justify-center transition-colors';

  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-50`}
        aria-label="이전 페이지"
      >
        <ChevronLeft size={16} />
      </button>

      {blockStart > 1 && (
        <button onClick={() => onChange(blockStart - 1)} className={`${btn} text-gray-400 hover:bg-gray-50`}>…</button>
      )}

      {nums.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`${btn} ${
            p === page ? 'bg-gray-900 text-white font-medium' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p}
        </button>
      ))}

      {blockEnd < totalPages && (
        <button onClick={() => onChange(blockEnd + 1)} className={`${btn} text-gray-400 hover:bg-gray-50`}>…</button>
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btn} border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-50`}
        aria-label="다음 페이지"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
