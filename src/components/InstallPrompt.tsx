'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { isRunningInInstalledApp, isTwaAppInstalled } from '@/lib/installState';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED_KEY = 'pwaInstalled';

/**
 * Android Chrome 용 PWA 설치 배너.
 *
 * 노출 조건 (4개 모두 충족해야 표시):
 *   1. beforeinstallprompt 이벤트가 도착 (Chrome 이 PWA 설치 가능하다고 판단)
 *   2. 비동기 TWA 설치 여부 검사 완료
 *   3. 디바이스에 TWA (com.dylabs.pawdex) 가 설치되어 있지 않음
 *   4. 유저가 이 세션에서 닫지 않음
 *
 * 추가로 초기 마운트에서 즉시 제외되는 케이스:
 *   - 이미 PWA/TWA 로 실행 중 (standalone OR TWA referrer)
 *   - 과거에 appinstalled 이벤트가 찍혔던 적 있음 (localStorage 기록)
 *
 * 왜 비동기 검사 완료를 기다리나:
 *   getInstalledRelatedApps() 가 비동기라, 이벤트 도착 즉시 배너를 띄우면
 *   그 직후 "TWA 있음" 판정 → 배너 사라짐. 이런 깜빡임을 방지하려고
 *   asyncCheckDone flag 로 게이팅.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hasTwa, setHasTwa] = useState(false);
  const [asyncCheckDone, setAsyncCheckDone] = useState(false);

  useEffect(() => {
    // 1) 이미 설치된 환경 (PWA 또는 TWA 안)에서 실행 중이면 종료.
    if (isRunningInInstalledApp()) return;

    // 2) 과거 appinstalled 기록 → 종료.
    try {
      if (localStorage.getItem(INSTALLED_KEY) === '1') return;
    } catch {
      /* noop */
    }

    // 3) TWA 앱이 디바이스에 설치되어 있는지 비동기 검사. 이벤트와 병렬.
    let cancelled = false;
    isTwaAppInstalled().then(installed => {
      if (cancelled) return;
      setHasTwa(installed);
      setAsyncCheckDone(true);
    });

    // 4) beforeinstallprompt 이벤트 수집. Chrome 이 "이 PWA 는 설치
    //    가능함" 이라고 판단하면 발동. prompt() 를 preventDefault 로
    //    가로채서 우리가 원하는 타이밍에 띄운다.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        /* noop */
      }
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 모든 조건 AND — 하나라도 어긋나면 숨김.
  if (!deferredPrompt || !asyncCheckDone || hasTwa || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        /* noop */
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[75] max-w-md mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Smartphone size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900">PawDex 앱 설치하고 더 빠르게!</p>
          <p className="text-[11px] text-gray-500">홈 화면에 추가하면 매일 더 편하게 관리할 수 있어요</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
        >
          <Download size={12} />
          설치
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
