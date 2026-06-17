'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/i18n/config';

/**
 * 언어 전환 — 쿠키(NEXT_LOCALE) 저장 후 새로고침(reload-on-switch).
 * 라우팅을 건드리지 않고 서버 렌더 locale 만 바꾼다.
 * (추후: 로그인 유저는 profiles.preferred_language 에도 동기화)
 */
export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const t = useTranslations('settings');
  const [pending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    // path=/ (전 경로 적용), max-age 1년(세션 종료 후에도 유지), SameSite=Lax.
    // Secure 는 일부러 생략 — localhost(http) 개발 환경에서 쿠키가 안 잡히는 문제 방지.
    // (프로덕션은 HTTPS + SameSite=Lax 라 CSRF 위험 낮음)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      window.location.reload();
    });
  };

  const options: { value: Locale; label: string }[] = [
    { value: 'ko', label: t('korean') },
    { value: 'en', label: t('english') },
  ];

  // 글자 크기·기본 반려동물 선택 UI 와 동일한 알약(pill) 버튼 스타일로 통일.
  return (
    <div className="flex gap-2" role="group" aria-label={t('language')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending}
          onClick={() => setLocale(opt.value)}
          className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
            locale === opt.value
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
