'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

/**
 * Service Worker 가 업데이트됐을 때 하단에 표시되는 토스트.
 *
 * 표준 PWA 업데이트 패턴 사용:
 *   - 새 SW 는 sw.js 의 skipWaiting 제거로 "waiting" 상태에 머무름
 *   - reg.waiting (마운트 시) 또는 updatefound + installed 전환으로 감지
 *   - [지금 적용] 클릭 → postMessage({type: 'SKIP_WAITING'}) → controllerchange → reload
 *   - waiting 상태는 유저 액션까지 지속되므로 race condition 없음
 *
 * 첫 SW 설치 (기존 controller 없음) 에는 토스트 안 보임.
 */
export function UpdateToast() {
  const [show, setShow] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // 첫 설치 (컨트롤러 없음) → 업데이트 아님
    if (!navigator.serviceWorker.controller) return;

    let dismissTimer: ReturnType<typeof setTimeout>;

    const reveal = (sw: ServiceWorker) => {
      setWaitingSW(sw);
      setShow(true);
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => setShow(false), 10000);
    };

    const attachTo = (reg: ServiceWorkerRegistration) => {
      // 이미 waiting 중인 SW 가 있으면 즉시 노출 (race condition 해결)
      if (reg.waiting) {
        reveal(reg.waiting);
        return;
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // installed 로 전환됐는데 기존 controller 가 있으면 = 업데이트 대기 중
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            reveal(sw);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) attachTo(reg);
    });

    return () => {
      clearTimeout(dismissTimer);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingSW) return;

    // 새 SW 가 활성화되면 자동으로 reload (controllerchange 이후)
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // waiting SW 에게 skipWaiting 지시
    waitingSW.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[80] max-w-md mx-auto">
      <div className="bg-blue-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <Sparkles size={18} className="flex-shrink-0" />
        <span className="text-xs font-medium flex-1">새 버전이 준비됐어요</span>
        <button
          onClick={applyUpdate}
          className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
        >
          지금 적용
        </button>
        <button
          onClick={() => setShow(false)}
          className="text-white/70 hover:text-white flex-shrink-0"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
