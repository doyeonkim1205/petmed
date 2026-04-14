'use client';

import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';

const HINT_KEY = 'darkModeHintShown';
const TRIGGER_KEY = 'darkModeHintTrigger';

export function DarkModeHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      // 이미 안내를 본 적이 있으면 표시하지 않음
      if (localStorage.getItem(HINT_KEY) === 'true') return false;

      // 앱 내 다크모드가 이미 켜져 있으면 표시하지 않음
      if (localStorage.getItem('theme') === 'dark') return false;

      // 시스템 다크모드 감지
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!systemDark) return false;

      // OAuth 트리거가 있어야 표시 (구글 로그인 후 등)
      if (localStorage.getItem(TRIGGER_KEY) !== 'true') return false;

      // TWA/PWA standalone에서는 표시하지 않음 (우리가 색상 제어)
      if (window.matchMedia('(display-mode: standalone)').matches) return false;
      if (document.referrer.startsWith('android-app://')) return false;

      // Chrome은 color-scheme:light 존중하므로 안 띄움
      // 다른 브라우저(삼성인터넷, 네이버 등)는 강제 다크 가능 → 표시
      const ua = navigator.userAgent;
      const isChrome = /Chrome\//.test(ua) && !/Edg|EdgA|OPR|SamsungBrowser|UCBrowser|YaBrowser|Whale|NAVER/.test(ua);
      if (isChrome) return false;

      return true;
    };

    if (!check()) return;

    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem(HINT_KEY, 'true');
    localStorage.removeItem(TRIGGER_KEY);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(HINT_KEY, 'true');
    localStorage.removeItem(TRIGGER_KEY);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[100]">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-0.5 text-gray-300 hover:text-gray-500"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Moon size={16} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-gray-800">화면이 어둡게 보이셨나요?</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          기기가 다크 모드로 설정되어 있어<br />
          앱이 전체적으로 어둡게 표시됐어요.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          앱 다크 모드를 켜면<br />
          더 편안하게 이용할 수 있어요.
        </p>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          또는 기기/브라우저 설정에서<br />
          라이트 모드로 변경하실 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleEnable}
            className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-medium rounded-full"
          >
            앱 다크 모드 켜기
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-full"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
