'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 첫 방문 안내 말풍선 — X(닫기) 누를 때까지 매 방문 노출. X 누르면 localStorage 기록 → 다시 안 뜸.
 * 증상 분석의 "사진으로 분석하기" 톤: 하늘색 바탕 + 파란 테두리 + 위 방향 꼬리.
 *   storageKey: 안내별 고유 키 (예: 'hint_stats_filter')
 *   pointer: 위쪽 꼬리(삼각형) 위치 — 가리킬 대상 방향. 'none' 이면 꼬리 없음.
 */
export function OnboardHint({
  storageKey,
  text,
  pointer = 'left',
}: {
  storageKey: string;
  text: string;
  pointer?: 'left' | 'right' | 'center' | 'none';
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setShow(true);
    } catch { /* localStorage 불가 환경 — 안내 생략 */ }
  }, [storageKey]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* noop */ }
    setShow(false);
  };

  const tail =
    pointer === 'right' ? 'right-4'
    : pointer === 'center' ? 'left-1/2 -translate-x-1/2'
    : 'left-4';

  return (
    <div className="relative flex items-start gap-2 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-medium text-white shadow-[0_3px_14px_rgba(37,99,235,0.40)]">
      {pointer !== 'none' && (
        <span className={`absolute -top-1 ${tail} w-2.5 h-2.5 rotate-45 bg-blue-600`} />
      )}
      <p className="flex-1 leading-snug break-keep break-words whitespace-pre-line">{text}</p>
      <button onClick={dismiss} aria-label="닫기" className="-mt-0.5 flex-shrink-0 text-white/70 transition hover:text-white active:scale-90">
        <X size={13} />
      </button>
    </div>
  );
}
