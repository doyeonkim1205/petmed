import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { isLocale, resolveLocale, LOCALE_COOKIE } from './config';

// next-intl "라우팅 없음" 설정 — URL 에 /en 세그먼트를 두지 않고
// 쿠키(NEXT_LOCALE)로 서버 렌더 locale 을 결정한다.
// 우선순위: ① 쿠키(사용자 명시 선택) → ② 브라우저 언어(Accept-Language) → ③ 기본 ko.
// (OAuth 콜백·푸시·결제·Capacitor 원격로드 경로를 건드리지 않기 위한 선택)
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;

  let locale: string;
  if (isLocale(cookieLocale)) {
    // ① 사용자가 토글로 명시 선택했거나 계정 동기화로 seed 된 쿠키 — 최우선.
    locale = cookieLocale;
  } else {
    // ② 첫 방문(쿠키 없음) → 브라우저 언어 자동 감지. 한국 거주 외국인이 폰 언어가
    //    영어면 첫 실행부터 영어로. 영어가 아니면 ③ 기본 한국어.
    const acceptLanguage = (await headers()).get('accept-language');
    locale = resolveLocale(acceptLanguage);
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
