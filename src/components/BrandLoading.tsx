'use client';

import { Loader2 } from 'lucide-react';

/**
 * 로그인(OAuth 콜백)·콜드스타트(세션 확인) 공통 로딩 화면 — 로딩 스피너만.
 *
 * 브랜드 로고/텍스트 없이 스피너 하나만 중앙에 둔다. 콜백(/auth/callback)과
 * (main) 레이아웃 가드가 '동일한' 이 화면을 쓰므로, 로그인 시 두 로딩이 번갈아
 * 깜박이던 현상이 사라진다. 언어 무관(텍스트 없음).
 */
export function BrandLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <Loader2 className="animate-spin text-blue-500 motion-reduce:animate-none" size={28} />
    </div>
  );
}
