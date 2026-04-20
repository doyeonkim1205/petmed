'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

/**
 * Service Worker 가 업데이트됐을 때 하단에 표시되는 토스트.
 *
 * 동작:
 *   - 새 SW 가 "activated" 상태로 넘어가고, 기존 controller 가 있었으면 (= 첫 설치가 아님)
 *     → 업데이트가 발생한 것이므로 토스트 노출
 *   - [지금 적용] 클릭 → 페이지 reload (새 JS 로드)
 *   - X 또는 10초 경과 → 토스트 dismiss, 다음 네비게이션 때 자동으로 새 코드 반영
 *
 * isDirty 보호: 자동 reload 하지 않고 유저에게 선택권을 주는 이유는,
 * 기록 편집 중인 유저의 작성 내용을 날리지 않기 위함.
 */
export function UpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let dismissTimer: ReturnType<typeof setTimeout>;

    const reveal = () => {
      setShow(true);
      dismissTimer = setTimeout(() => setShow(false), 10000);
    };

    // 기존 controller 없으면 = 첫 설치 → 업데이트 아님, 토스트 안 띄움
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.addEventListener('controllerchange', reveal);

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') reveal();
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reveal);
      clearTimeout(dismissTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[80] max-w-md mx-auto">
      <div className="bg-blue-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <Sparkles size={18} className="flex-shrink-0" />
        <span className="text-xs font-medium flex-1">새 버전이 준비됐어요</span>
        <button
          onClick={() => window.location.reload()}
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
