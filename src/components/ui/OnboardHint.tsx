'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

/**
 * 안내 말풍선 — X(닫기)를 누르기 전까진 매 방문 노출, 닫으면 localStorage 에 기록돼 다신 안 뜸.
 *   (뜨자마자 사라지는 1회성이 아니라, 사용자가 직접 닫아야 사라짐 → 인지율 ↑)
 * 톤: 증상분석 사진 물풍선과 동일 — 흰 배경 + 파란 테두리/글자(blue-300/600) + 위 방향 꼬리.
 *   storageKey: 안내별 고유 키 (예: 'hint_stats_filter'). 문구/디자인 갱신 시 _v2 처럼 올려 재노출.
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
  const tr = useTranslations();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setShow(true); // 아직 안 닫았으면 노출
    } catch { /* localStorage 불가 환경 — 안내 생략 */ }
  }, [storageKey]);

  // 닫을 때만 '봤음' 처리 → 그 전까진 매 방문 노출 (놓침 방지).
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(storageKey, '1'); } catch { /* noop */ }
  };

  if (!show) return null;

  const tail =
    pointer === 'right' ? 'right-4'
    : pointer === 'center' ? 'left-1/2 -translate-x-1/2'
    : 'left-4';

  return (
    <div className="relative flex items-start gap-2 rounded-xl bg-white border border-blue-300 px-3 py-2 text-[11px] font-medium text-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.12)]">
      {pointer !== 'none' && (
        <span className={`absolute -top-1 ${tail} w-2.5 h-2.5 rotate-45 bg-white border-l border-t border-blue-300`} />
      )}
      <p className="flex-1 leading-snug break-keep break-words whitespace-pre-line">{text}</p>
      <button onClick={dismiss} aria-label={tr('common.close')} className="-mt-0.5 flex-shrink-0 text-blue-400 transition hover:text-blue-600 active:scale-90">
        <X size={13} />
      </button>
    </div>
  );
}
