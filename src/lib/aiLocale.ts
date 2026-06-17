import type { NextRequest } from 'next/server';
import { isLocale, resolveLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';

/**
 * AI 라우트의 응답 언어 결정 — 클라이언트 본문 변경 없이 NEXT_LOCALE 쿠키를 직접 읽는다.
 * (UI 의 단일 locale 소스인 쿠키를 서버 AI 생성에도 그대로 사용 → 일관성)
 * 우선순위: ① NEXT_LOCALE 쿠키 → ② Accept-Language → ③ 기본 ko.
 */
export function localeFromRequest(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return resolveLocale(request.headers.get('accept-language'));
}
