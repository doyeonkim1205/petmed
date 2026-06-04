'use client';

import { useEffect } from 'react';

/**
 * 모바일에서 input/textarea focus 시 OS 키보드가 input 을 가리는 문제 fix.
 *
 * 흐름:
 *   1. focusin 이벤트 — 모든 input/textarea/select 잡힘
 *   2. 300ms 대기 (키보드 올라오는 시간)
 *   3. element.scrollIntoView({ block: 'nearest' }) — 최소 스크롤 (보이면 안 움직임)
 *
 * CSS scroll-margin (globals.css) 의 top/bottom 마진과 함께 — fixed 저장 영역 + Footer
 * 위로 input 이 충분히 떨어진 위치에 보이도록.
 *
 * layout 의 root 에 한 번만 mount.
 */
export function KeyboardScrollFix() {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.matches) return;
      if (!t.matches('input, textarea, select')) return;
      // type='hidden' / 'submit' / 'button' 같은 비입력 input 은 스킵
      if (t instanceof HTMLInputElement) {
        const nonInteractive = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];
        if (nonInteractive.includes(t.type)) return;
      }
      setTimeout(() => {
        try {
          t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch {}
      }, 300);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  return null;
}
