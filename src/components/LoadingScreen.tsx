'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

/**
 * 로딩 중 화면.
 *
 * - 기본 (inMain=false): viewport 전체. 앱 시작/인증 가드/OAuth 콜백 등 풀스크린 용도.
 *   스플래시와 '동일하게' 흰 배경 + 가운데 앱 아이콘 + 아래 스피너 → 스플래시→로딩 전환이
 *   끊김 없이 이어져 깜박임처럼 안 보인다. (스피너로 "로딩 중"도 전달)
 * - inMain=true: (main)/layout 의 Header(56px) + Footer(72px) 제외 영역 중앙. 스피너만.
 *
 * motion-reduce 접근성 설정이 켜진 기기에선 스피너 회전 멈춤.
 */
export function LoadingScreen({ inMain = false }: { inMain?: boolean }) {
  const t = useTranslations();

  if (inMain) {
    return (
      <div
        className="flex items-center justify-center bg-white"
        style={{ minHeight: 'calc(100vh - 128px)' }}
      >
        <Loader2
          size={28}
          className="text-blue-400 animate-spin motion-reduce:animate-none"
          aria-label={t('common.loading')}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center bg-white"
      style={{ minHeight: '100vh' }}
    >
      {/* 스플래시와 동일한 앱 아이콘 — 스플래시 화면이 그대로 이어지는 것처럼 보이게.
          eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-512x512.png" alt="PawDex" className="h-28 w-28" />
      <Loader2
        size={24}
        className="mt-6 text-blue-400 animate-spin motion-reduce:animate-none"
        aria-label={t('common.loading')}
      />
    </div>
  );
}
