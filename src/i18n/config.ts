// 지원 로케일 — 처음부터 좁게(union) 고정. en-US/ja 확장은 그때 명시적으로 추가.
export const locales = ['ko', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ko';

// 언어 선택을 담는 쿠키 키 — 서버 렌더의 단일 기준(SSR이 이 쿠키로 locale 결정).
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// 비로그인/쿠키 없음 → navigator.language 등 후보에서 지원 로케일 추정(기본 ko).
export function resolveLocale(candidate: string | undefined | null): Locale {
  if (isLocale(candidate)) return candidate;
  if (candidate && candidate.toLowerCase().startsWith('en')) return 'en';
  return defaultLocale;
}
