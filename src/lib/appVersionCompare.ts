// 앱 스토어 업데이트 게이트 — 빌드/버전 비교 유틸.
//   ⚠️ 같은 플랫폼 값끼리만 비교(Android versionCode ↔ iOS CFBundleVersion 은 별개 숫자공간).
//   판정은 build 로, 화면 표시는 version 으로. 비정상 값은 null → 호출부 fail-open.

// 세그먼트 자릿수 상한 — 2^53 안전정수 이내(실제 빌드번호는 훨씬 작음). 초과=비정상 처리(precision 오판 방지).
const MAX_SEGMENT_DIGITS = 9;

/**
 * 빌드 문자열을 숫자 세그먼트 배열로. "43"→[43], "1.0.9"→[1,0,9].
 * 비정상(빈 값·비숫자·빈 세그먼트·초장문 세그먼트)이면 null.
 *   허용: 앞뒤 공백(trim), leading zero("01"→1).
 *   불허: 문자 포함("1.0-beta"), trailing dot("1."), 빈 세그먼트("1..0"), 9자리 초과.
 */
export function parseBuildSegments(v: unknown): number[] | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  const parts = t.split('.');
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p) || p.length > MAX_SEGMENT_DIGITS) return null;
    nums.push(parseInt(p, 10));
  }
  return nums;
}

/**
 * 빌드 비교. a<b → -1, a==b → 0, a>b → 1. 어느 쪽이든 비정상이면 null(비교불가).
 * 짧은 쪽은 0 으로 패딩("1.0" == "1.0.0"). "9" < "10"(숫자), "1.0.9" < "1.0.10"(세그먼트).
 */
export function compareBuild(a: string, b: string): number | null {
  const pa = parseBuildSegments(a);
  const pb = parseBuildSegments(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export interface UpdateConfig {
  enabled: boolean;
  latestBuild: string | null;       // null → 선택 업데이트 OFF
  minSupportedBuild: string | null; // null → 필수 업데이트 OFF
}

/**
 * 업데이트 판정 — 'force'(필수) | 'soft'(선택) | 'none'(표시 안 함).
 *   설치 < min → force / 설치 < latest → soft / 그 외 → none.
 * 안전 규칙:
 *   - enabled=false → none.
 *   - min>latest(운영자 오설정) 또는 min/latest 비교불가 → 설정오류로 보고 none(fail-open, force 로 막지 않음).
 *   - 어느 비교든 비교불가(null) → none(fail-open).
 * ⚠️ 필수(force)는 반드시 "현재 실행에서 받은 신선한 서버 응답"으로만 호출할 것(캐시 응답 금지). 이 함수는 순수 판정만.
 */
export function decideUpdate(installedBuild: string, cfg: UpdateConfig): 'force' | 'soft' | 'none' {
  if (!cfg.enabled) return 'none';
  const { latestBuild, minSupportedBuild } = cfg;

  // 설정오류 방어: min 과 latest 가 둘 다 있는데 min>latest(또는 비교불가) → 전체 신뢰불가 → none.
  if (minSupportedBuild != null && latestBuild != null) {
    const rel = compareBuild(minSupportedBuild, latestBuild);
    if (rel === null || rel > 0) return 'none';
  }

  // 필수: min 설정 + 설치 < min.
  if (minSupportedBuild != null) {
    const c = compareBuild(installedBuild, minSupportedBuild);
    if (c === null) return 'none';
    if (c < 0) return 'force';
  }

  // 선택: latest 설정 + 설치 < latest.
  if (latestBuild != null) {
    const c = compareBuild(installedBuild, latestBuild);
    if (c === null) return 'none';
    if (c < 0) return 'soft';
  }

  return 'none';
}

/**
 * 원격 설정값 유효성 검증(서버 API 에서 응답 전 사용). 통과 못 하면 API 는 enabled:false 로 응답.
 *   - store_url 은 해당 플랫폼 공식 스토어 HTTPS 주소
 *   - reminder_days >= 1
 *   - latest_build / min_supported_build 는 (있다면) 유효한 빌드 문자열
 *   - min_supported_build <= latest_build (둘 다 있을 때)
 */
export function isValidUpdateConfig(
  platform: 'android' | 'ios',
  row: {
    latest_build: string | null;
    min_supported_build: string | null;
    store_url: string | null;
    reminder_days: number | null;
  },
): boolean {
  const officialHost = platform === 'android'
    ? 'https://play.google.com/'
    : 'https://apps.apple.com/';
  if (!row.store_url || !row.store_url.startsWith(officialHost)) return false;
  if (row.reminder_days == null || row.reminder_days < 1) return false;
  if (row.latest_build != null && parseBuildSegments(row.latest_build) === null) return false;
  if (row.min_supported_build != null && parseBuildSegments(row.min_supported_build) === null) return false;
  if (row.min_supported_build != null && row.latest_build != null) {
    const rel = compareBuild(row.min_supported_build, row.latest_build);
    if (rel === null || rel > 0) return false; // min > latest = 오설정
  }
  return true;
}

const DAY_MS = 86_400_000;

/**
 * 소프트 업데이트 "나중에" 억제 만료 시각(ms epoch) — 누른 시각 + reminderDays 일.
 * 이후 재실행 때 now < until 이면 억제, now >= until 이면 재표시.
 */
export function softDismissUntil(dismissedAtMs: number, reminderDays: number): number {
  return dismissedAtMs + Math.max(1, reminderDays) * DAY_MS;
}

/**
 * localStorage 에 저장된 만료값 기준으로 현재 억제 중인지.
 *   값 없음/비정상 → false(억제 안 함=표시). 만료 시각 도달(now >= until) → false(재표시).
 */
export function isSoftDismissActive(storedUntilRaw: string | null | undefined, nowMs: number): boolean {
  if (storedUntilRaw == null) return false;
  const until = Number(storedUntilRaw);
  return Number.isFinite(until) && nowMs < until;
}
