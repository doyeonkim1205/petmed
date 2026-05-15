'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, Copy, X, Check } from 'lucide-react';
import { detectDevice } from '@/lib/deviceDetect';
import { isRunningInInstalledApp } from '@/lib/installState';

const DISMISS_KEY = 'androidInAppHintDismissedAt';
const DISMISS_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h

// Intent scheme 성공/실패 판정 대기 시간.
// 저사양 단말 + Android 의 "다른 앱으로 열기" 다이얼로그 지연까지 감안한
// 여유분. 너무 짧으면 성공 케이스에 모달이 잠깐 떴다가 사라지는 깜빡임
// 발생, 너무 길면 유저가 버튼 먹통으로 인지.
const INTENT_TIMEOUT_MS = 2000;

/**
 * Android + 인앱 WebView (카카오톡/인스타/네이버/페북 등) 유저 안내.
 *
 * UX 흐름:
 *   1) 배너의 "Chrome으로 열기" 탭 → 즉시 intent scheme 으로 Chrome 실행 시도
 *   2) 성공 시 (페이지가 hidden 상태로 전환됨): 모달 안 뜨고 유저는 Chrome 으로 이동
 *   3) 실패 시 (2초 지나도 페이지 visible): Intent 가 차단됐다고 판단하고 모달 표시
 *   4) 모달 표시 중에도 visibilitychange 감지 — 뒤늦게 Intent 성공하면 모달 자동 닫기
 *      (고아 모달 방지)
 *
 * 모달은 "주소 복사 + 직접 열기 가이드" 만 남긴 미니 구조. Intent 가 실패해서
 * 뜨는 UI 이므로 같은 Intent 재시도 버튼은 제거.
 */
export function AndroidInAppBrowserHint() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Intent 실패 감지용 setTimeout id 보관.
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const t = setTimeout(() => setShowBanner(true), 100);
    return () => clearTimeout(t);
  }, []);

  // 모달이 떠있는 동안 페이지가 hidden 으로 전환되면 (뒤늦게 Intent 성공 등)
  // 모달 자동 닫기. 유저가 Chrome 으로 이동한 뒤 PawDex 탭으로 돌아왔을 때
  // 고아 모달이 남아있는 걸 방지.
  useEffect(() => {
    if (!showModal) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setShowModal(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [showModal]);

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
        /* 최종 실패 — 유저가 수동 복사해야 함 */
      }
      document.body.removeChild(textarea);
    }
  };

  /**
   * 배너의 "Chrome으로 열기" 버튼.
   * Intent 로 Chrome 강제 실행 시도 → 2초 내 성공 감지 없으면 모달 팝업.
   */
  const handleOpenChrome = () => {
    const host = window.location.host;
    const path = window.location.pathname + window.location.search + window.location.hash;
    const intentUrl = `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;

    // visibilitychange 로 Intent 성공 감지.
    // Intent 가 성공하면 브라우저가 Chrome 으로 이동하면서 현재 페이지가
    // hidden 상태가 됨.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (intentTimerRef.current) {
          clearTimeout(intentTimerRef.current);
          intentTimerRef.current = null;
        }
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    try {
      window.location.href = intentUrl;
    } catch {
      /* intent URL 생성 실패 (드묾) */
    }

    // 2초 뒤에도 페이지가 visible 이면 Intent 가 차단된 걸로 판단.
    intentTimerRef.current = setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      intentTimerRef.current = null;
      if (document.visibilityState === 'visible') {
        setShowBanner(false);
        setShowModal(true);
      }
    }, INTENT_TIMEOUT_MS);
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
              <p className="text-xs font-semibold text-gray-900">PawDex를 앱처럼 사용해 보세요</p>
              <p className="text-[11px] text-gray-500">Chrome으로 열면 설치와 알림 기능을 사용할 수 있어요</p>
            </div>
            <button
              onClick={handleOpenChrome}
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Smartphone size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Chrome에서 열어주세요</h3>
              </div>
              <button
                onClick={dismissAll}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-4"
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
