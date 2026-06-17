'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/i18n/config';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * 언어 전환 — 쿠키(NEXT_LOCALE) 저장 후 새로고침(reload-on-switch).
 * 라우팅을 건드리지 않고 서버 렌더 locale 만 바꾼다.
 * 로그인 유저는 profiles.preferred_language 에도 저장 → 다른 기기에서 다음 로그인 시 반영.
 */
export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const t = useTranslations('settings');
  const { user } = useAuth();
  const [pending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    // path=/ (전 경로 적용), max-age 1년(세션 종료 후에도 유지), SameSite=Lax.
    // Secure 는 일부러 생략 — localhost(http) 개발 환경에서 쿠키가 안 잡히는 문제 방지.
    // (프로덕션은 HTTPS + SameSite=Lax 라 CSRF 위험 낮음)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(async () => {
      // 로그인 유저면 계정에도 저장(다른 기기 동기화). 실패해도 쿠키 전환은 진행.
      if (user) {
        try {
          await supabase.from('profiles').update({ preferred_language: next }).eq('id', user.id);
        } catch { /* 네트워크 실패 무시 — 쿠키 기반 전환은 동작 */ }
      }
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
