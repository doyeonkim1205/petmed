'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 첫 방문 안내 말풍선 — X(닫기) 누르면 localStorage 에 기록해 다시 안 뜸.
 * 사진 분석 툴팁과 동일한 다크(gray-900) 스타일.
 *   storageKey: 안내별 고유 키 (예: 'hint_stats_filter')
 */
export function OnboardHint({ storageKey, text }: { storageKey: string; text: string }) {
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
    <div className="flex items-start gap-2 bg-gray-900 text-white text-[11px] leading-relaxed rounded-md py-2 pl-2.5 pr-2 shadow-lg">
      <p className="flex-1 break-keep break-words">{text}</p>
      <button onClick={dismiss} aria-label="닫기" className="flex-shrink-0 text-white/60 hover:text-white active:scale-90 transition">
        <X size={13} />
      </button>
    </div>
  );
}
