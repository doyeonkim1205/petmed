// 서비스 지역(marketRegion) — 언어(language)와 분리된 별도 축.
// 언어: UI 문구·AI 응답 언어(사용자 선택). 지역: 통화·단위·지도 provider 등 지역별 기본값.
// ⚠️ 타임존은 지역이 '아니다' — 최초 추정 힌트로만 쓰고, 확정은 프로필값/사용자선택이 우선.

export type MarketRegion = 'KR' | 'US';
export type MarketRegionSource = 'legacy_default' | 'timezone_inferred' | 'user_selected';

export const marketRegions: readonly MarketRegion[] = ['KR', 'US'];
export const defaultMarketRegion: MarketRegion = 'KR';

export function isMarketRegion(v: string | null | undefined): v is MarketRegion {
  return v === 'KR' || v === 'US';
}

// 주요 미국 IANA 타임존. 여기 없으면 US 로 '단정'하지 않는다(일본·캐나다·유럽을 US 로 오분류 금지).
const US_TIME_ZONES = new Set<string>([
  'America/New_York', 'America/Detroit', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
  'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Vevay',
  'America/Chicago', 'America/Indiana/Tell_City', 'America/Indiana/Knox', 'America/Menominee',
  'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
  'America/Denver', 'America/Boise', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Metlakatla',
  'America/Yakutat', 'America/Nome', 'America/Adak', 'Pacific/Honolulu',
]);

/**
 * 기기 타임존으로 지역을 '추정'한다. 확신 없으면 null.
 * Asia/Seoul → KR, 알려진 미국 타임존 → US, 그 외(일본/유럽/캐나다 등) → null(보류).
 */
export function inferMarketRegion(timeZone: string | undefined | null): MarketRegion | null {
  if (!timeZone) return null;
  if (timeZone === 'Asia/Seoul') return 'KR';
  if (US_TIME_ZONES.has(timeZone)) return 'US';
  return null;
}

// 지역별 기본값. ⚠️ 구독가격은 여기에 넣지 않는다(스토어 응답이 원본).
export const REGION_DEFAULTS = {
  KR: { currency: 'KRW', measurementSystem: 'metric' },
  US: { currency: 'USD', measurementSystem: 'us' },
} as const;

export type Currency = 'KRW' | 'USD';

// 지역의 기본 통화. 기록 생성 시 이 값을 기록에 '복사'해 저장한다(표시할 때 재추론 금지).
export function currencyForRegion(region: MarketRegion): Currency {
  return REGION_DEFAULTS[region].currency;
}

/**
 * 금액 표시. 통화기호·소수 자릿수·구분기호를 Intl 포매터가 처리(문자열에 기호 박지 않기).
 * amount = major unit (KRW: 388550, USD: 49.99). currency 는 '기록에 저장된 값'을 넘긴다.
 * KRW → "₩388,550" (소수 0자리), USD → "$49.99" (소수 2자리).
 */
export function formatMoney(amount: number, currency: Currency = 'KRW', locale: string = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return String(amount);
  }
}
