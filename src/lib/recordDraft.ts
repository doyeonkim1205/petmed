/**
 * 기록 추가/수정 폼의 임시 저장(draft) 헬퍼.
 *
 * 동작:
 *   - 사용자가 입력하면 localStorage 에 자동 저장 (debounce 는 호출부)
 *   - 페이지 진입 시 draft 있으면 모달로 복원 확인
 *   - 저장 성공 또는 "새로 시작" 시 draft 삭제
 *   - 24시간 후 자동 만료
 *
 * 의도적으로 제외:
 *   - 사진/첨부 (File 객체는 JSON 직렬화 불가 + base64 시 quota 초과)
 *   - 약(medications) (푸시 권한·구독 상태 의존, DB id 충돌, frequency-alarm_times 동기화 복잡)
 *   복원 후 안내 문구로 "약·첨부는 다시 선택해주세요" 표시.
 *
 * 안전:
 *   - 모든 localStorage 접근 try/catch (Safari private mode quota=0 / quota exceeded 방어)
 *   - corrupted draft → 자동 제거
 *   - schema 버전 불일치 → 자동 제거
 *   - edit: 서버 record.updated_at 보다 오래된 draft 면 자동 폐기 (stale 덮어쓰기 방지)
 *   - key 에 userId 포함 → 공유 디바이스 격리
 */

import type { RecordType, DailySubKind } from './supabase';

const SCHEMA_VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * draft 에 저장할 필드 화이트리스트.
 * medications, files 는 의도적으로 제외 (위 주석 참고).
 */
export interface RecordDraft {
  recordType?: RecordType;
  title?: string;
  description?: string;
  hospitalName?: string;
  cost?: string;
  weight?: string;
  symptomTime?: string;
  visitDate?: string;
  dischargeDate?: string;
  nextAppointmentDate?: string;
  recordColor?: string;
  nextAppointmentColor?: string;
  petId?: string;
  selectedSubKinds?: DailySubKind[];
}

interface DraftEnvelope {
  data: RecordDraft;
  ts: number;
  v: number;
}

export const draftKey = {
  add: (userId: string) => `pawdex-record-draft-add-${userId}`,
  edit: (userId: string, recordId: string) => `pawdex-record-draft-edit-${recordId}-${userId}`,
};

/** localStorage 에 draft 저장. 실패는 silent (quota / private mode). */
export function saveDraft(key: string, data: RecordDraft): void {
  try {
    const envelope: DraftEnvelope = { data, ts: Date.now(), v: SCHEMA_VERSION };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // ignore
  }
}

/**
 * draft 로드. null 반환 케이스:
 *   - draft 없음
 *   - 만료(24h)
 *   - 스키마 버전 불일치
 *   - corrupted JSON
 *   - edit: 서버 데이터(serverUpdatedAt) 가 draft 보다 최신
 * 위 케이스들은 모두 localStorage 정리도 함께 수행.
 */
export function loadDraft(
  key: string,
  opts?: { serverUpdatedAt?: string | null },
): RecordDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope;
    if (!env || typeof env !== 'object' || env.v !== SCHEMA_VERSION) {
      clearDraft(key);
      return null;
    }
    if (Date.now() - env.ts > TTL_MS) {
      clearDraft(key);
      return null;
    }
    if (opts?.serverUpdatedAt) {
      const serverTs = new Date(opts.serverUpdatedAt).getTime();
      if (!Number.isNaN(serverTs) && serverTs > env.ts) {
        // 서버에서 더 최신으로 업데이트됨 → stale draft 폐기
        clearDraft(key);
        return null;
      }
    }
    return env.data;
  } catch {
    clearDraft(key);
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
