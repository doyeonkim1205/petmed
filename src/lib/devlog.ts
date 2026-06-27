/**
 * 임시 진단 로거 — 기기 세션(claim/verify) 흐름을 앱 화면에서 직접 읽기 위함.
 * localStorage 에 누적(로그인→로그아웃→재로그인 사이클 넘어 유지) + console 출력.
 * ⚠️ 디버깅용. 원인 파악 후 제거.
 */
const KEY = '__devlog';
const MAX = 80;

export function dlog(msg: string): void {
  try {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const line = `${ts} ${msg}`;
    // eslint-disable-next-line no-console
    console.log('[devlog]', line);
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    arr.push(line);
    while (arr.length > MAX) arr.shift();
    localStorage.setItem(KEY, JSON.stringify(arr));
    window.dispatchEvent(new Event('devlog'));
  } catch {}
}

export function readDevlog(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearDevlog(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('devlog'));
  } catch {}
}
