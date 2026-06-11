'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 첫 방문 안내 말풍선 — X(닫기) 누르면 localStorage 에 기록해 다시 안 뜸.
 * 증상 분석의 "사진으로 분석하기" 툴팁과 동일 톤: 흰 바탕 + 파란 테두리/글자 + 위 방향 꼬리.
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
    <div className="relative flex items-start gap-2 rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-[11px] font-medium text-blue-600 shadow-md">
      {pointer !== 'none' && (
        <span className={`absolute -top-1 ${pointer === 'right' ? 'right-4' : 'left-4'} w-2 h-2 rotate-45 border-l border-t border-blue-300 bg-white`} />
      )}
      <p className="flex-1 leading-snug break-keep break-words">{text}</p>
      <button onClick={dismiss} aria-label="닫기" className="-mt-0.5 flex-shrink-0 text-blue-400 transition hover:text-blue-600 active:scale-90">
        <X size={13} />
      </button>
    </div>
  );
}
