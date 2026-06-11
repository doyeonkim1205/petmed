'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * 첫 방문 안내 말풍선 — 처음 뜬 순간 '봤음' 처리(localStorage)라 다음 방문엔 안 뜸(X 안 눌러도).
 * X 는 즉시 닫기용. 증상 분석의 "사진으로 분석하기" 톤: 흰 바탕 + 파란 테두리 + 위 방향 꼬리.
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
      if (!localStorage.getItem(storageKey)) {
        setShow(true);
        localStorage.setItem(storageKey, '1'); // 처음 본 순간 '봤음' 처리 → 다음 방문엔 안 뜸
      }
    } catch { /* localStorage 불가 환경 — 안내 생략 */ }
  }, [storageKey]);

  if (!show) return null;

  const tail =
    pointer === 'right' ? 'right-4'
    : pointer === 'center' ? 'left-1/2 -translate-x-1/2'
    : 'left-4';

  return (
    <div className="relative flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-2 text-[11px] font-medium text-gray-900 shadow-md">
      {pointer !== 'none' && (
        <span className={`absolute -top-1 ${tail} w-2 h-2 rotate-45 border-l border-t border-sky-300 bg-sky-100`} />
      )}
      <p className="flex-1 leading-snug break-keep break-words">{text}</p>
      <button onClick={() => setShow(false)} aria-label="닫기" className="-mt-0.5 flex-shrink-0 text-gray-400 transition hover:text-gray-600 active:scale-90">
        <X size={13} />
      </button>
    </div>
  );
}
