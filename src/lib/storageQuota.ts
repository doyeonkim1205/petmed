// 저장 용량 한도 판정 — 클라이언트 사전검사와 /api/storage-usage 가 같은 기준을 쓰도록 공용화.
//
// 기준:
//   - 사용량 = Storage(medical-files) 에 실제 저장된 바이트 (압축 후 크기). DB file_size 아님.
//   - 업로드 가능 = 현재 사용량 + 이번에 올릴 파일들(압축 후) 합계 ≤ 한도.
//   - limitMB 0 = 무제한. MB 는 기존과 동일하게 1024*1024 바이트.

export const BYTES_PER_MB = 1024 * 1024;

// 한 번의 요청에 넣을 수 있는 incoming 상한 — 비정상 값 방어용 (기록당 최대 첨부 × 파일당 상한보다 넉넉히).
export const MAX_INCOMING_BYTES = 200 * BYTES_PER_MB;

export interface QuotaResult {
  usedBytes: number;
  usedMB: number;
  limitMB: number;
  incomingBytes: number;
  canUpload: boolean;
}

export function toMB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MB) * 10) / 10;
}

export function evaluateQuota(usedBytes: number, incomingBytes: number, limitMB: number): QuotaResult {
  const used = Math.max(0, Math.floor(usedBytes || 0));
  const incoming = Math.max(0, Math.floor(incomingBytes || 0));
  const unlimited = limitMB === 0;
  return {
    usedBytes: used,
    usedMB: toMB(used),
    limitMB,
    incomingBytes: incoming,
    canUpload: unlimited || used + incoming <= limitMB * BYTES_PER_MB,
  };
}

// 쿼리스트링 incoming 파싱 — 숫자가 아니거나 음수/상한 초과면 null (API 가 400 처리).
export function parseIncomingBytes(raw: string | null): number | null {
  if (raw === null || raw === '') return 0;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > MAX_INCOMING_BYTES) return null;
  return n;
}
