'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * 출시 초기: sw.js 의 install 단계 skipWaiting 활성화 → 새 SW 즉시 활성화 →
 * activate 핸들러의 SW_ACTIVATED 메시지로 자동 reload 트리거.
 * UpdateToast 와 별개 경로 — 토스트 mount 전에 메시지 도착해도 reload 보장.
 *
 * 이전 controller 가 있던 경우만 reload (첫 설치는 reload 불필요).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Don't register SW on payment pages — Toss redirects get intercepted
    if (window.location.pathname.startsWith('/payment')) return;

    // 이미 controller 있는 = 옛 SW 통제 중. 새 SW activate 시 자동 reload.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;

    const onMessage = (e: MessageEvent) => {
      if (!hadController) return;            // 첫 설치 → reload 불필요
      if (e.data?.type !== 'SW_ACTIVATED') return;
      if (reloaded) return;
      reloaded = true;
      // 무한 reload 방지 sentinel — sessionStorage 에 한 번 reload 했다 표시.
      try {
        if (sessionStorage.getItem('sw-auto-reloaded') === '1') return;
        sessionStorage.setItem('sw-auto-reloaded', '1');
      } catch {}
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force check for updates immediately
      reg.update();
    }).catch(() => {});

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
