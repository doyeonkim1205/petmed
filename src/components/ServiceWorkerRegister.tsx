'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * NOTE: 업데이트 감지 후 UI 처리는 UpdateToast 컴포넌트에서 담당.
 * 여기서 자동 reload 를 하지 않는 이유는 유저가 편집 중일 때 작업을
 * 잃지 않도록 하기 위함. UpdateToast 가 [지금 적용] 버튼으로 유저에게
 * 선택권을 넘겨줌.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Don't register SW on payment pages — Toss redirects get intercepted
    if (window.location.pathname.startsWith('/payment')) return;

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force check for updates immediately
      reg.update();
    }).catch(() => {});
  }, []);

  return null;
}
