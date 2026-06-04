'use client';

import { useEffect } from 'react';

/**
 * 모바일에서 input/textarea focus 시 OS 키보드가 input 을 가리는 문제 fix.
 *
 * 흐름:
 *   1. focusin 이벤트 — 모든 input/textarea/select 잡힘
 *   2. 300ms 대기 (키보드 올라오는 시간)
 *   3. element.scrollIntoView({ block: 'center' }) — 화면 가운데로
 *
 * CSS scroll-margin-block 과 함께 — globals.css 에 100-120px 마진.
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
          t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {}
      }, 300);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  return null;
}
