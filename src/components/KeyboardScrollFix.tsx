'use client';

import { useEffect } from 'react';

/**
 * 모바일에서 input/textarea focus 시 OS 키보드 처리.
 *
 * 두 가지 흐름:
 *
 * 1. focusin → scrollIntoView({ block: 'nearest' })
 *    - input 이 viewport 안에 안 들어가 있으면 최소 스크롤로 보이게.
 *
 * 2. visualViewport.resize → body.keyboard-open 클래스 토글
 *    - 키보드 ON 감지 → 'keyboard-open' 추가
 *    - 키보드 OFF 감지 → 'keyboard-open' 제거
 *    - 이 클래스 + globals.css 의 .keyboard-hide-on-open 조합으로
 *      fixed 저장 버튼 / Footer 같은 하단 영역을 자동 숨김 → input 가림 해소.
 *
 * visualViewport API 는 iOS 15+ / Android Chrome 모두 지원.
 *
 * layout 의 root 에 한 번만 mount.
 */
export function KeyboardScrollFix() {
  useEffect(() => {
    // ① focusin → 최소 스크롤
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.matches) return;
      if (!t.matches('input, textarea, select')) return;
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

    // ② visualViewport 로 키보드 ON/OFF 감지 → body class 토글
    const vv = window.visualViewport;
    let onVvResize: (() => void) | null = null;
    if (vv) {
      onVvResize = () => {
        // 키보드 높이 임계치 100px — 작은 OS UI 변동은 키보드로 오인 안 함
        const keyboardOpen = window.innerHeight - vv.height > 100;
        document.body.classList.toggle('keyboard-open', keyboardOpen);
      };
      vv.addEventListener('resize', onVvResize);
      vv.addEventListener('scroll', onVvResize);
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      if (vv && onVvResize) {
        vv.removeEventListener('resize', onVvResize);
        vv.removeEventListener('scroll', onVvResize);
      }
      document.body.classList.remove('keyboard-open');
    };
  }, []);
  return null;
}
