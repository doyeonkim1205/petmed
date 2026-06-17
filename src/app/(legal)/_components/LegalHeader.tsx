'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * 약관/정책 페이지 공용 sticky 헤더.
 * 기준: src/app/(main)/records/[id]/page.tsx 의 헤더 스타일과 동일.
 * - justify-between + spacer 로 제목 중앙 정렬
 * - 화살표 w-5 h-5 / 제목 text-sm font-semibold gray-700
 */
export function LegalHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 z-10 bg-white dark:bg-gray-900">
      <button
        onClick={() => router.back()}
        className="absolute left-2 p-2 text-gray-500 dark:text-gray-300"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h1>
    </header>
  );
}

/**
 * 약관/정책 페이지 공용 wrapper — 헤더 + main 영역.
 * 각 page.tsx 가 이걸로 감싸기만 하면 헤더 + 콘텐츠 wrapper 일관.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <LegalHeader title={title} />
      <main className="px-6 py-6 max-w-2xl mx-auto">{children}</main>
    </>
  );
}

/**
 * 영문(참고용 번역) 페이지 상단에 노출하는 고지 배너.
 * 한국어 원문 우선 — 법적 고지본은 한국어가 정본임을 명시.
 */
export function LegalRefNotice({ text }: { text: string }) {
  return (
    <p className="not-prose text-[11px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 mb-6 leading-relaxed">
      {text}
    </p>
  );
}
