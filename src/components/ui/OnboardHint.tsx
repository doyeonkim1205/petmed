'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 첫 방문 안내 말풍선 — X(닫기) 누르면 localStorage 에 기록해 다시 안 뜸.
 *   storageKey: 안내별 고유 키 (예: 'hint_stats_filter')
 *   pointer: 위쪽 삼각형 위치 (가리킬 대상 방향). 'none' 이면 삼각형 없음.
 */
export function OnboardHint({
  storageKey,
  text,
  pointer = 'left',
}: {
  storageKey: string;
  text: string;
  pointer?: 'left' | 'right' | 'none';
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

  return (
    <div className="relative">
      {pointer !== 'none' && (
        <span className={`absolute -top-1 ${pointer === 'right' ? 'right-5' : 'left-5'} w-2.5 h-2.5 rotate-45 bg-indigo-600`} />
      )}
      <div className="relative flex items-start gap-2 bg-indigo-600 text-white rounded-xl px-3 py-2.5 shadow-md">
        <p className="flex-1 text-[12px] leading-snug break-keep break-words">{text}</p>
        <button onClick={dismiss} aria-label="닫기" className="flex-shrink-0 -mr-0.5 -mt-0.5 p-0.5 text-white/80 hover:text-white active:scale-90 transition">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
