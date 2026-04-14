'use client';

import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';

const HINT_KEY = 'darkModeHintShown';

export function DarkModeHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 이미 안내를 본 적이 있으면 표시하지 않음
    if (localStorage.getItem(HINT_KEY) === 'true') return;

    // 앱 내 다크모드가 이미 켜져 있으면 표시하지 않음
    if (localStorage.getItem('theme') === 'dark') return;

    // 시스템 다크모드 감지
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!systemDark) return;

    // 모든 조건 충족 → 안내 표시 (1초 후)
    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem(HINT_KEY, 'true');
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(HINT_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[100]">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Moon size={18} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 mb-0.5">어두운 화면을 사용 중이신가요?</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            앱 다크 모드를 켜면 더 편안하게 이용할 수 있어요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnable}
              className="flex-1 py-2 bg-blue-600 text-white text-xs font-medium rounded-full"
            >
              켜기
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-full"
            >
              나중에
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-0.5 text-gray-300 hover:text-gray-500"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
