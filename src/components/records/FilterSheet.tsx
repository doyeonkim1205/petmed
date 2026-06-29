'use client';

import { X, Lock } from 'lucide-react';

/**
 * 기록 페이지 공용 필터 바텀시트 (건강통계·지출·타임라인 통일).
 * 헤더의 필터 아이콘(SlidersHorizontal)으로 열고, 안에 "기간" 등 섹션을 넣는다.
 * 배경 클릭/X/완료로 닫힘 — 건강통계 지표편집 시트와 동일 스타일.
 */
export function FilterSheet({
  open,
  title,
  closeLabel,
  doneLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  doneLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-white rounded-t-2xl p-4 pb-6 max-h-[82vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600" aria-label={closeLabel}><X size={20} /></button>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900 text-center mb-4">{title}</h3>
        {children}
        <button onClick={onClose}
          className="w-full h-11 mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors">{doneLabel}</button>
      </div>
    </div>
  );
}

/**
 * 필터 시트 안 "기간" 섹션 — 칩 + (플랜 잠금 칩) + 라벨.
 * 라벨 키가 페이지마다 달라(stats/expenses=expenses.period.*, timeline=timeline.period.*)
 * 칩 데이터({id,label})는 호출부에서 만들어 넘긴다.
 */
export function PeriodSection({
  label,
  options,
  value,
  onChange,
  lockedOptions,
  onLockedClick,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  lockedOptions?: { id: string; label: string }[];
  onLockedClick?: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === o.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{o.label}</button>
        ))}
        {lockedOptions?.map((o) => (
          <button key={o.id} onClick={onLockedClick}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-300 flex items-center gap-1">
            <Lock size={11} />{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
