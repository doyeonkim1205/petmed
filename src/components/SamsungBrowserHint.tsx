'use client';

import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';

const HINT_KEY = 'samsungHintShown';

export function SamsungBrowserHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // ?resetSamsungHint=1 쿼리로 플래그 초기화 (테스트용)
    if (new URLSearchParams(window.location.search).get('resetSamsungHint') === '1') {
      localStorage.removeItem(HINT_KEY);
    }

    if (localStorage.getItem(HINT_KEY) === 'true') return;
    if (localStorage.getItem('theme') === 'dark') return;
    if (!/SamsungBrowser/i.test(navigator.userAgent)) return;

    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(HINT_KEY, 'true');
    setShow(false);
  };

  const handleOpenChrome = () => {
    // Chrome 앱 강제 실행 (없으면 현재 페이지에 머무름)
    const host = window.location.host;
    const path = window.location.pathname + window.location.search;
    const fallback = encodeURIComponent(window.location.href);
    window.location.href =
      `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30" onClick={handleDismiss}>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 w-full max-w-sm relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-0.5 text-gray-300 hover:text-gray-500"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Moon size={16} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-gray-800">화면이 어둡게 보이시나요?</p>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          삼성 인터넷의 <span className="font-bold text-gray-700">자동 다크 모드</span>로 일부 화면이 다르게 표시될 수 있어요.
          <br /><br />
          <span className="font-bold text-gray-700">Chrome 에서 열면</span> 화면을 더 자연스럽게 볼 수 있고,
          어두운 테마를 원하시면 <span className="font-bold text-gray-700">앱 설정에서 다크 모드</span>를 켜 주세요.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleOpenChrome}
            className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-full"
          >
            Chrome 으로 열기
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-bold rounded-full"
          >
            그냥 쓸게요
          </button>
        </div>
      </div>
    </div>
  );
}
