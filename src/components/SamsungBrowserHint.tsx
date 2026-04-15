'use client';

import { useEffect, useState } from 'react';
import { Moon, X, ChevronRight } from 'lucide-react';

const HINT_KEY = 'samsungHintShown';

export function SamsungBrowserHint() {
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState(false);

  useEffect(() => {
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

  const handleOpenChromeSettings = () => {
    // Android 기본 앱 설정 intent 시도
    try {
      window.location.href =
        'intent://#Intent;action=android.settings.MANAGE_DEFAULT_APPS_SETTINGS;end';
    } catch {
      // 실패 시 단계별 안내 표시
      setHowto(true);
    }
    // 3초 뒤 intent 실패 판단 → 안내 모달
    setTimeout(() => {
      if (document.visibilityState === 'visible') setHowto(true);
    }, 1500);
  };

  if (!show) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[100]">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 relative">
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

        <p className="text-xs text-gray-500 leading-relaxed mb-3">
          삼성 인터넷에서는 <span className="font-bold text-gray-700">자동 다크 모드</span>가 적용되어
          앱 색상이 다르게 표시될 수 있어요.
        </p>

        <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
          <span className="font-bold">더 편안하게 이용하려면:</span>
        </p>
        <ul className="text-xs text-gray-500 leading-relaxed mb-4 space-y-1 pl-0.5">
          <li>• 삼성 인터넷 설정에서 다크 모드 끄기</li>
          <li>
            • 또는 <span className="font-bold text-gray-700">Chrome 을 기본 브라우저로 설정</span>
          </li>
        </ul>

        <div className="flex gap-2">
          <button
            onClick={handleOpenChromeSettings}
            className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-full"
          >
            Chrome 설정 열기
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-bold rounded-full"
          >
            그냥 쓸게요
          </button>
        </div>

        {howto && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1.5">
            <p className="font-bold text-gray-700">수동 설정 방법</p>
            <p className="flex items-center gap-1">설정 <ChevronRight size={12} /> 앱 <ChevronRight size={12} /> 기본 앱 선택</p>
            <p className="flex items-center gap-1">브라우저 앱 <ChevronRight size={12} /> Chrome 선택</p>
          </div>
        )}
      </div>
    </div>
  );
}
