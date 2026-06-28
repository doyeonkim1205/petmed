/**
 * first-touch attribution — 첫 방문(첫 터치) 유입 정보.
 *
 * 가입 시 auth.signup 의 details(jsonb) 에 합쳐 저장해서 "이 가입자가 어디서 왔는지"를 본다.
 * - write-once: 진짜 "첫 터치"만 기록(이후 내부 이동/재방문엔 덮어쓰지 않음).
 * - referrer 는 전체 URL 대신 hostname 만 저장(쿼리스트링에 섞일 수 있는 PII 회피).
 * - 한계: localStorage 라 캐시삭제·시크릿·ITP 만료 시 유실되고, 앱 WebView 와 브라우저는
 *   저장소가 분리돼 설치 전 출처는 앱으로 안 넘어옴(=많은 케이스가 direct/unknown 으로 잡힘).
 */
const FT_KEY = 'pawdex_ft';

export interface FirstTouch {
  ft_ref?: string;   // referrer hostname (예: google.com, l.instagram.com)
  ft_src?: string;   // utm_source
  ft_med?: string;   // utm_medium
  ft_cmp?: string;   // utm_campaign
  ft_cnt?: string;   // utm_content
  ft_trm?: string;   // utm_term
  ft_land?: string;  // landing path (첫 진입 경로)
  ft_ts?: number;    // captured at (epoch ms)
}

/** 첫 방문 1회만 기록. 이미 있으면 아무것도 안 함(true first-touch 보존). */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(FT_KEY)) return; // write-once
    const sp = new URLSearchParams(window.location.search);
    let refHost = '';
    if (document.referrer) {
      try { refHost = new URL(document.referrer).hostname; } catch {}
    }
    // 자기 자신(내부 이동)은 유입 referrer 가 아니므로 비움.
    if (refHost && refHost === window.location.hostname) refHost = '';
    const data: FirstTouch = {
      ft_ref: refHost || undefined,
      ft_src: sp.get('utm_source') || undefined,
      ft_med: sp.get('utm_medium') || undefined,
      ft_cmp: sp.get('utm_campaign') || undefined,
      ft_cnt: sp.get('utm_content') || undefined,
      ft_trm: sp.get('utm_term') || undefined,
      ft_land: window.location.pathname || undefined,
      ft_ts: Date.now(),
    };
    // undefined 키는 JSON.stringify 가 자동 제거 → 있는 값만 저장.
    localStorage.setItem(FT_KEY, JSON.stringify(data));
  } catch {}
}

/** 저장된 first-touch 반환(없으면 빈 객체). 가입 로그 details 에 spread 해서 씀. */
export function getFirstTouch(): FirstTouch {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FT_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
