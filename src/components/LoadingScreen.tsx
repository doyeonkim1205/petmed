'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

/**
 * 로딩 중 스피너.
 *
 * - 기본 (inMain=false): viewport 전체 (min-h-screen). auth 가드 등 fullscreen 용도.
 * - inMain=true: (main)/layout 의 Header(56px) + Footer(72px) 제외한 영역 중앙.
 *   페이지 안에서 사용 시 정확한 중앙 정렬.
 *
 * motion-reduce 접근성 설정이 켜진 기기에선 스피너 회전 멈춤.
 */
export function LoadingScreen({ inMain = false }: { inMain?: boolean }) {
  const t = useTranslations();
  return (
    <div
      className="flex items-center justify-center bg-white"
      style={{ minHeight: inMain ? 'calc(100vh - 128px)' : '100vh' }}
    >
      <Loader2
        size={28}
        className="text-blue-400 animate-spin motion-reduce:animate-none"
        aria-label={t('common.loading')}
      />
    </div>
  );
}
