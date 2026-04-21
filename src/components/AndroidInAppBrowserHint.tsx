'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Copy, ExternalLink, X, Check } from 'lucide-react';
import { detectDevice } from '@/lib/deviceDetect';
import { isRunningInInstalledApp } from '@/lib/installState';

const DISMISS_KEY = 'androidInAppHintDismissedAt';
const DISMISS_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h (iOS 인앱 힌트와 동일 주기)
const TWA_PACKAGE = 'com.dylabs.pawdex';

/**
 * Android + 인앱 WebView (카카오톡/인스타/네이버/페북 등) 유저 안내.
 *
 * 배너 → 모달 2단계. iOS InAppBrowserHint 와 같은 구조.
 *
 * 배너:
 *   ✨ PawDex 를 앱처럼 사용해 보세요.
 *   Chrome 으로 열면 설치와 알림 기능을 사용할 수 있어요.
 *   [ Chrome 으로 열기 ]  [X]
 *
 * 모달 (배너의 Chrome 으로 열기 탭 시):
 *   - "Chrome 으로 바로 이동 시도" (intent scheme — 인앱별 성공률 다름)
 *   - "주소 복사하기" (확실한 fallback)
 *   - 인앱별 직접 열기 가이드
 */
export function AndroidInAppBrowserHint() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const device = detectDevice();
    if (!device || !device.isAndroidInAppBrowser) return;
    if (device.isStandalone) return;
    if (isRunningInInstalledApp()) return;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_WINDOW_MS) return;
    } catch {
      /* noop */
    }

    // iOS 힌트와 동일한 100ms 방어 (display-mode 판정 지연 대비)
    const t = setTimeout(() => setShowBanner(true), 100);
    return () => clearTimeout(t);
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  const dismissAll = () => {
    setShowModal(false);
    dismissBanner();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API 실패 fallback
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
        /* 최종 실패 — 유저가 수동 복사 필요 */
      }
      document.body.removeChild(textarea);
    }
  };

  const handleOpenChrome = () => {
    // Android intent scheme 으로 Chrome 강제 실행 시도.
    // 카카오톡은 자주 차단하지만 시도는 무해 (실패해도 앱 크래시 없음).
    // 성공 케이스: 네이버 / 인스타 일부 / 라인.
    try {
      const host = window.location.host;
      const path = window.location.pathname + window.location.search + window.location.hash;
      const intentUrl = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
    } catch {
      /* noop — 유저가 수동으로 Chrome 열어야 함 */
    }
  };

  if (!showBanner && !showModal) return null;

  return (
    <>
      {showBanner && !showModal && (
        <div className="fixed bottom-20 left-3 right-3 z-[75] max-w-md mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Smartphone size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900">✨ PawDex를 앱처럼 사용해 보세요.</p>
              <p className="text-[11px] text-gray-500">Chrome으로 열면 설치와 알림 기능을 사용할 수 있어요.</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
            >
              Chrome으로 열기
            </button>
            <button
              onClick={dismissBanner}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onClick={dismissAll}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Smartphone size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Chrome으로 열어주세요</h3>
              </div>
              <button
                onClick={dismissAll}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              현재 브라우저에서는 PawDex의 설치와 알림 기능을 사용할 수 없어요. Chrome에서 열어주세요.
            </p>

            <div className="space-y-2 mb-4">
              <button
                onClick={handleCopy}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check size={16} /> 복사됨! Chrome을 열어 붙여넣어 주세요
                  </>
                ) : (
                  <>
                    <Copy size={16} /> 주소 복사하기
                  </>
                )}
              </button>
              <button
                onClick={handleOpenChrome}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} /> Chrome으로 바로 이동 시도
              </button>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
                💡 직접 열고 싶다면
              </p>
              <ul className="text-[11px] text-gray-500 leading-relaxed space-y-0.5">
                <li>• 카카오톡: 우측 상단 <span className="font-medium">⋮</span> → 다른 브라우저로 열기</li>
                <li>• 네이버: 하단 <span className="font-medium">⋯</span> → 다른 앱으로 열기</li>
                <li>• 인스타/페이스북: 우측 상단 <span className="font-medium">⋮</span> → 외부 브라우저에서 열기</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// lint-safe export (TWA_PACKAGE 를 여기선 직접 안 쓰지만 추후 intent
// URL 에 package 지정이 필요해질 경우 참조용)
export const _TWA_PACKAGE = TWA_PACKAGE;
