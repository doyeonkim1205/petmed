'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone, Copy, X, Check } from 'lucide-react';
import { detectDevice } from '@/lib/deviceDetect';
import { isRunningInInstalledApp } from '@/lib/installState';
import { isNativeApp } from '@/lib/platform';

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
  const t = useTranslations();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Capacitor 네이티브 앱(iOS WKWebView)은 "Safari 아님"으로 오인돼 안내가 뜨므로 차단.
    // 네이티브 앱은 이미 정식 앱이라 인앱브라우저 안내가 불필요.
    if (isNativeApp()) return;
    const device = detectDevice();
    if (!device || !device.needsSafariTransition || device.isStandalone) return;
    // TWA / PWA 컨텍스트에선 hint 전혀 불필요 (설치된 앱 안에선 이미
    // 원하는 브라우저로 돌고 있음). referrer 캐시 기반으로 한 번 더 방어.
    if (isRunningInInstalledApp()) return;

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
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Smartphone size={20} className="text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">{t('browserHint.safariTitle')}</h3>
          </div>
          <button
            onClick={dismiss}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label={t('common.close')}
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
              <Check size={16} /> {t('browserHint.copiedSafari')}
            </>
          ) : (
            <>
              <Copy size={16} /> {t('browserHint.copyUrl')}
            </>
          )}
        </button>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
            {t('browserHint.directOpen')}
          </p>
          <ul className="text-[11px] text-gray-500 leading-relaxed space-y-0.5">
            <li>• {t('browserHint.kakaoGuide')}</li>
            <li>• {t('browserHint.instaNaverGuide')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
