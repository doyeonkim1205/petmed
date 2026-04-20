'use client';

import { useEffect, useState, useCallback } from 'react';
import { Share, Plus, X, Smartphone } from 'lucide-react';
import { detectDevice } from '@/lib/deviceDetect';

const DISMISS_KEY = 'iosInstallDismissedAt';
const DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * iOS Safari + not-yet-installed 유저 전용 홈 화면 추가 안내.
 *
 * 노출 흐름:
 *   1. 첫 진입 (또는 마지막 dismiss 로부터 24h 경과) → 하단 배너
 *   2. 배너 탭 → 단계별 설치 가이드 모달
 *   3. "다음에" → localStorage 타임스탬프 저장, 24h 동안 안 뜸
 *
 * 문구는 의도적으로 "상단/하단" 등 위치 용어를 피함. iOS Safari 는
 * 주소창을 상단/하단으로 유저가 설정할 수 있어서 위치를 단언하면
 * 엉뚱한 곳을 찾게 됨. 대신 아이콘 모양 (공유 [↑□]) 을 강조.
 *
 * NotificationModal 에서도 같은 모달을 띄울 수 있도록 전역
 * `window.dispatchEvent(new Event('show-ios-install'))` 이벤트 지원.
 */
export function IosInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const decideVisibility = useCallback(() => {
    const device = detectDevice();
    if (!device) return false;
    if (!device.isIosSafari) return false;
    if (device.isStandalone) return false;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_WINDOW_MS) return false;
    } catch {
      /* localStorage 접근 실패 (privacy mode 등) 시 그냥 노출 */
    }
    return true;
  }, []);

  useEffect(() => {
    // 100ms delay: 일부 iOS 환경에서 display-mode 값이 페이지 로드 직후
    // 바로 확정되지 않는 케이스를 방어.
    const t = setTimeout(() => {
      if (decideVisibility()) setShowBanner(true);
    }, 100);

    const forceOpen = () => {
      setShowBanner(true);
      setShowModal(true);
    };
    window.addEventListener('show-ios-install', forceOpen);

    return () => {
      clearTimeout(t);
      window.removeEventListener('show-ios-install', forceOpen);
    };
  }, [decideVisibility]);

  const dismissBanner = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
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
              <p className="text-xs font-semibold text-gray-900">앱처럼 사용하기</p>
              <p className="text-[11px] text-gray-500">홈 화면에 추가하면 더 편해요</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
            >
              설치 방법
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
          className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowModal(false)}
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
                <h3 className="text-base font-bold text-gray-900">홈 화면에 추가</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              PawDex 를 앱처럼 빠르게 열고 알림까지 받아보세요.
            </p>

            <ol className="space-y-4 mb-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    Safari 의 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 rounded text-gray-800 font-medium"><Share size={11} /> 공유</span> 버튼을 탭하세요
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    메뉴에서 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 rounded text-gray-800 font-medium"><Plus size={11} /> 홈 화면에 추가</span> 를 선택하세요
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    우측 상단 <span className="font-medium text-gray-900">추가</span> 버튼을 탭하면 완료!
                  </p>
                </div>
              </li>
            </ol>

            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 mb-5">
              <p className="text-[11px] text-blue-700 leading-relaxed">
                💡 알림을 받으려면 iOS 16.4 이상에서 홈 화면에 추가해야 해요.
              </p>
            </div>

            <button
              onClick={() => {
                setShowModal(false);
                setShowBanner(false);
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
