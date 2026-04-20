'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Copy, ExternalLink, X, Check } from 'lucide-react';
import { detectDevice } from '@/lib/deviceDetect';

const DISMISS_KEY = 'inAppBrowserHintDismissedAt';
const DISMISS_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h — 더 짧게 (Safari 전환이 중요)

/**
 * iOS + not-Safari (카카오톡/인스타/Chrome/기타 인앱) 유저에게
 * "Safari 에서 열어주세요" 안내.
 *
 * 특정 브라우저 화이트리스트 대신 "iOS && !Safari" 전체를 커버하는
 * fallback 전략. 새 인앱 브라우저가 나와도 자동 대응됨.
 *
 * URL 복사 + x-safari-https:// 스킴 시도를 병행. x-safari-https 는
 * iOS 버전에 따라 막힐 수 있지만 실패해도 무해 (onerror 없음).
 * 실제로 유저가 의존하는 건 URL 복사 + 메뉴 가이드.
 */
export function InAppBrowserHint() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const device = detectDevice();
    if (!device || !device.needsSafariTransition || device.isStandalone) return;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_WINDOW_MS) return;
    } catch {
      /* noop */
    }

    // 100ms 딜레이 (IosInstallPrompt 와 동일 방어)
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API 실패 (권한, HTTP 등) 시 textarea fallback
      const textarea = document.createElement('textarea');
      textarea.value = window.location.origin;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* 최종 실패 — 유저가 수동 복사해야 함 */
      }
      document.body.removeChild(textarea);
    }
  };

  const handleOpenSafari = () => {
    // x-safari-https:// 시도. 실패해도 앱 크래시 없음.
    // iOS 9+ 일부 환경에서 작동, 대부분은 차단되지만 시도하는 게 손해 없음.
    try {
      const url = window.location.origin.replace(/^https:/, 'x-safari-https:');
      window.location.href = url;
    } catch {
      /* noop — 유저가 직접 복사해서 Safari 로 가야 함 */
    }
  };

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <AlertCircle size={20} className="text-orange-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Safari 에서 열어주세요</h3>
          </div>
          <button
            onClick={dismiss}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          현재 브라우저에서는 PawDex 의 홈 화면 추가와 알림 기능을 사용할 수
          없어요. Safari 에서 열어주세요.
        </p>

        <div className="space-y-2 mb-4">
          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check size={16} /> 복사됨! Safari 를 열어 붙여넣어 주세요
              </>
            ) : (
              <>
                <Copy size={16} /> 주소 복사하기
              </>
            )}
          </button>
          <button
            onClick={handleOpenSafari}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} /> Safari 로 바로 이동 시도
          </button>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
            💡 직접 열고 싶다면
          </p>
          <ul className="text-[11px] text-gray-500 leading-relaxed space-y-0.5">
            <li>• 카카오톡: 우측 상단 <span className="font-medium">⋮</span> → 다른 브라우저로 열기</li>
            <li>• 인스타/네이버: 메뉴에서 외부 브라우저 열기</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
