'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, X } from 'lucide-react';
import { useAppUpdate } from '@/contexts/AppUpdateContext';

// 선택(soft) 업데이트 안내 — 홈 진입 후 1.5s 뒤 노출. 닫기 가능. 필수(force)는 v1 미구현.
//   dismiss 키 = platform + latestBuild → 새 빌드 나오면 다시 뜸. reminderDays 지나면 같은 빌드도 재노출.
//   스토어 딥링크는 window.open(_system) — Capacitor 가 외부(스토어)로 연다.

function dismissKey(platform: string, latestBuild: string) {
  return `app-update-dismissed:${platform}:${latestBuild}`;
}

export function OptionalUpdateModal() {
  const t = useTranslations();
  const pathname = usePathname();
  const { decision, latestBuild, storeUrl, reminderDays, platform } = useAppUpdate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 홈에서만, soft 이고, 값이 있고, 최근 "나중에" 억제기간이 아닐 때만 1.5s 뒤 노출.
    if (decision !== 'soft' || pathname !== '/' || !latestBuild || !storeUrl) return;
    try {
      const raw = localStorage.getItem(dismissKey(platform, latestBuild));
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && Date.now() < until) return; // reminderDays 억제 기간 내
      }
    } catch { /* localStorage 불가 → 그냥 노출 */ }
    const id = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(id);
  }, [decision, pathname, latestBuild, storeUrl, platform]);

  if (!visible || !storeUrl || !latestBuild || typeof document === 'undefined') return null;

  const later = () => {
    try {
      localStorage.setItem(dismissKey(platform, latestBuild), String(Date.now() + reminderDays * 86400000));
    } catch { /* ignore */ }
    setVisible(false);
  };
  const update = () => {
    try { window.open(storeUrl, '_system'); } catch { window.location.href = storeUrl; }
    setVisible(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={later}>
      <div
        className="relative w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 text-center"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={later} aria-label={t('common.close')} className="absolute top-2.5 right-2.5 p-1 text-gray-300 hover:text-gray-500 active:scale-90 transition">
          <X size={18} />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <Sparkles size={26} className="text-blue-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1.5">{t('appUpdate.soft.title')}</h2>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5 whitespace-pre-line">{t('appUpdate.soft.body')}</p>
        <div className="flex gap-2">
          <button onClick={later} className="flex-1 h-11 rounded-full bg-gray-100 text-gray-600 font-medium text-sm active:bg-gray-200 transition-colors">
            {t('appUpdate.later')}
          </button>
          <button onClick={update} className="flex-1 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors">
            {t('appUpdate.update')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
