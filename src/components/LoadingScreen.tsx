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
      className="relative flex items-center justify-center bg-white"
      style={{ minHeight: '100vh' }}
    >
      {/* 아이콘은 스플래시와 '동일한 위치(화면 정중앙) + 크기'로 고정 — flex 중앙정렬.
          스피너를 함께 묶어 정렬하면 아이콘이 위로 밀려 스플래시와 어긋나므로,
          스피너는 absolute 로 아이콘 아래에만 얹어 아이콘 위치를 건드리지 않는다.
          eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-512x512.png" alt="PawDex" className="h-44 w-44" />
      <Loader2
        size={24}
        className="absolute left-1/2 -translate-x-1/2 text-blue-400 animate-spin motion-reduce:animate-none"
        style={{ top: 'calc(50% + 116px)' }}
        aria-label={t('common.loading')}
      />
    </div>
  );
}
