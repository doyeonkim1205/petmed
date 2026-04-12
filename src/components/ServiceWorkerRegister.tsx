'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Don't register SW on payment pages — Toss redirects get intercepted
    if (window.location.pathname.startsWith('/payment')) return;

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force check for updates immediately
      reg.update();

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    }).catch(() => {});
  }, []);

  return null;
}
