import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';

// next-intl "라우팅 없음" 설정 — URL 에 /en 세그먼트를 두지 않고
// 쿠키(NEXT_LOCALE)로 서버 렌더 locale 을 결정한다.
// (OAuth 콜백·푸시·결제·Capacitor 원격로드 경로를 건드리지 않기 위한 선택)
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
