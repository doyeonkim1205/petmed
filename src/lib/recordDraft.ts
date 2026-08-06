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

// v2: isDirty 가드 추가 (실제 입력 시에만 저장). v1 에 저장된 빈/record-값 draft 자동 폐기용.
const SCHEMA_VERSION = 2;
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
  nextAppointmentReason?: string;
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

/**
 * input/textarea 의 `name` 속성 → RecordDraft 필드 이름 매핑.
 *
 * pagehide 안전망 (IME 한글 조합 중 이탈 시 마지막 글자 유실 방지) 에서 사용:
 *   document.activeElement 가 input/textarea 면 그 DOM 의 `.value` 를 직접
 *   읽어 React state 우회 → setState batching/microtask race 가 발생해도 손실 X.
 *
 * autoComplete 회피용으로 의도된 변별 이름 (record-title, hospital-name, etc.)
 * 은 그대로 두고, 매핑 테이블로 RecordDraft 키와 연결.
 */
export const NAME_TO_FIELD: Record<string, keyof RecordDraft> = {
  'description': 'description',
  'record-title': 'title',
  'hospital-name': 'hospitalName',
  'pet-weight-kg': 'weight',
  'weight': 'weight',
  'cost': 'cost',
  'visit-date': 'visitDate',
  'discharge-date': 'dischargeDate',
  'next-appointment-date': 'nextAppointmentDate',
  'symptom-time': 'symptomTime',
};

/**
 * pagehide / visibilitychange 시점에 호출 — 현재 focus 된 input/textarea 가
 * 있으면 그 DOM 값을 snapshot 에 강제 override.
 *
 * 한글 IME 조합 중 (composition 미완료 상태) focus 잃을 때 React setState 가
 * 비동기로 큐잉되어 stateRef 가 stale 일 수 있다. DOM 의 `.value` 는 IME
 * 조합 중에도 즉시 최신값을 가지므로 신뢰 가능. el.blur() 로 compositionend
 * 강제 발생 후 value 읽음 (일부 환경에서 blur 가 composition 마무리 신호).
 */
export function captureFocusedInputValue(snapshot: RecordDraft): RecordDraft {
  try {
    const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return snapshot;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return snapshot;
    // compositionend 강제 — IME 조합 중 글자 확정시킴.
    el.blur();
    const name = el.getAttribute('name');
    if (!name) return snapshot;
    const field = NAME_TO_FIELD[name];
    if (!field) return snapshot;
    return { ...snapshot, [field]: el.value };
  } catch {
    return snapshot;
  }
}

/**
 * 로그아웃 시 모든 사용자의 draft localStorage / sessionStorage 키 정리.
 * 격리는 이미 보장되지만 (key 에 userId 포함) 디스크 정리 + defense in depth.
 */
export function clearAllDraftStorage(): void {
  try {
    // localStorage: pawdex-record-draft-*
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pawdex-record-draft-')) lsKeys.push(k);
    }
    lsKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
  try {
    // sessionStorage: pawdex-add-session, pawdex-edit-session-*
    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k === 'pawdex-add-session' || k.startsWith('pawdex-edit-session-'))) {
        ssKeys.push(k);
      }
    }
    ssKeys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
