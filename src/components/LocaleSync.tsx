'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';

/**
 * 로그인 유저의 계정 선호 언어(profiles.preferred_language)를 NEXT_LOCALE 쿠키로 seed.
 * - 새 기기/브라우저로 로그인 시 쿠키가 없거나 다르면 → 쿠키 설정 + 1회 새로고침.
 * - 새로고침 후엔 SSR locale === profile 값 → 재실행 안 함(루프 없음).
 * 쿠키가 SSR 렌더의 단일 기준이므로, 계정 값은 쿠키를 통해서만 반영된다.
 */
export function LocaleSync() {
  const locale = useLocale();
  const { profile } = useAuth();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    const pref = profile?.preferred_language;
    if (!isLocale(pref)) return;     // 미설정 → 쿠키/navigator 유지
    if (pref === locale) return;     // 이미 일치 → 아무것도 안 함
    seeded.current = true;
    document.cookie = `${LOCALE_COOKIE}=${pref}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.location.reload();
  }, [profile, locale]);

  return null;
}
