'use client';

import { Loader2 } from 'lucide-react';

/**
 * 브랜드 로딩 화면 — 로고 + 스피너 (텍스트 없음).
 *
 * 로그인(OAuth 콜백)·콜드스타트(세션 확인) 등 "홈 진입 전" 전환에 공통으로 쓴다.
 * 이전엔 콜백(로고+스피너)과 (main) 가드(헤더+스피너)가 서로 다른 모습이라
 * 로그인 시 두 로딩 화면이 번갈아 깜박였음 → 동일 화면으로 통일해 깜박임 제거.
 * 흰 배경 + 로고라 네이티브 스플래시(흰 배경+발바닥)와도 자연스럽게 이어진다.
 * 언어 무관(텍스트 없음).
 */
export function BrandLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-512x512.png" alt="PawDex" className="w-20 h-20 rounded-[22%] mb-5" />
      <Loader2 className="animate-spin text-blue-500" size={26} />
    </div>
  );
}
