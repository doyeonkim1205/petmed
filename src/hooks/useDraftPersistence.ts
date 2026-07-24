'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  draftKey,
  captureFocusedInputValue,
  type RecordDraft,
} from '@/lib/recordDraft';

/**
 * records/add 와 records/[id]/edit 에서 공통으로 쓰던 draft 자동 저장/복원 로직을
 * 단일 hook 으로 추출.
 *
 * 주요 기능:
 *   1. mount 시 localStorage 에서 draft 로드 + sessionStorage 세션 마커 체크
 *      - 같은 세션 (사용자가 작성 중 다른 앱 갔다 옴) → 모달 없이 onApplyDraft 자동 호출
 *      - 새 세션 (PWA 재시작 등) → pendingDraft 에 set 해서 호출부가 모달 띄움
 *   2. formState 가 변할 때마다 isDirty 면 자동 saveDraft (debounce 없음 — 동기)
 *   3. pagehide / visibilitychange 시 IME 안전망(captureFocusedInputValue) 적용해
 *      DOM value 직접 읽어 snapshot override 후 saveDraft
 *   4. edit 모드에선 recordOrigin 과 formState 비교 (hasFormDiverged) 로 dirty 자동 검출
 *      — form onChange 가 일부 환경에서 fire 안 되는 케이스 방어
 *
 * 호출부 책임:
 *   - formState 를 매 render 마다 최신 객체로 전달 (hook 내부 ref 가 mirror)
 *   - onApplyDraft 콜백에서 setter 들 호출해 폼에 draft 값 적용
 *   - recordOrigin: edit 에서 record 로드 후 한 번 set, add 면 undefined/null
 *   - ready: add 면 user 있을 때 true, edit 면 record 로드 완료 후 true
 */
interface UseDraftPersistenceOptions {
  variant: 'add' | 'edit';
  userId: string | undefined;
  recordId?: string;
  ready: boolean;
  formState: RecordDraft;
  recordOrigin?: RecordDraft | null;
  serverUpdatedAt?: string | null;
  onApplyDraft: (draft: RecordDraft) => void;
}

interface UseDraftPersistenceReturn {
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
  pendingDraft: RecordDraft | null;
  /** 모달의 [불러오기] 버튼 — onApplyDraft 호출 + dirty 켜기 + 모달 닫기 */
  applyDraft: () => void;
  /** 모달의 [새로 시작] 버튼 — draft 삭제 + 모달 닫기 (세션 마커는 유지) */
  discardDraft: () => void;
  /** 저장 성공 / 나가기 시 — draft + 세션 마커 정리 + dirty 해제 */
  clearDraftAndSession: () => void;
}

const ADD_SESSION_KEY = 'pawdex-add-session';
const editSessionKey = (recordId: string) => `pawdex-edit-session-${recordId}`;

function getKey(variant: 'add' | 'edit', userId: string, recordId?: string): string {
  return variant === 'add'
    ? draftKey.add(userId)
    : draftKey.edit(userId, recordId || '');
}

function getSessionKey(variant: 'add' | 'edit', recordId?: string): string {
  return variant === 'add' ? ADD_SESSION_KEY : editSessionKey(recordId || '');
}

export function useDraftPersistence(
  opts: UseDraftPersistenceOptions,
): UseDraftPersistenceReturn {
  const { variant, userId, recordId, ready, formState, recordOrigin, serverUpdatedAt, onApplyDraft } = opts;

  const [isDirty, setIsDirtyState] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<RecordDraft | null>(null);

  // ref mirror — 매 render 동기 mutation. listener / effect 안에서 stale closure 방지.
  const stateRef = useRef<RecordDraft>({});
  stateRef.current = formState;
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const recordOriginRef = useRef<RecordDraft | null | undefined>(recordOrigin);
  recordOriginRef.current = recordOrigin;
  const onApplyRef = useRef(onApplyDraft);
  onApplyRef.current = onApplyDraft;

  const draftCheckedRef = useRef(false);

  // 저장 직후 자동 draft 재생성 차단용 flag.
  // - clearDraftAndSession 호출 시 true → 모든 save 경로 (즉시 saveDraft useEffect
  //   + pagehide listener) 가드.
  // - 사용자가 다시 form 을 만져 isDirty=true 가 되면 false 로 reset (재 작성 의도).
  const savedRef = useRef(false);

  // setIsDirty wrapper — true 로 설정 시 savedRef 자동 reset (재 입력 시작).
  const setIsDirty = useCallback((v: boolean) => {
    if (v) savedRef.current = false;
    setIsDirtyState(v);
  }, []);

  // record 원본 vs 현재 form state 비교 — form onChange race 우회용 (edit 모드 전용).
  const hasFormDiverged = useCallback((): boolean => {
    const orig = recordOriginRef.current;
    if (!orig) return false;
    const cur = stateRef.current;
    const a = [...(cur.selectedSubKinds || [])].sort().join(',');
    const b = [...(orig.selectedSubKinds || [])].sort().join(',');
    return (
      cur.recordType !== orig.recordType ||
      cur.title !== orig.title ||
      cur.description !== orig.description ||
      cur.hospitalName !== orig.hospitalName ||
      cur.cost !== orig.cost ||
      cur.weight !== orig.weight ||
      cur.symptomTime !== orig.symptomTime ||
      cur.visitDate !== orig.visitDate ||
      cur.dischargeDate !== orig.dischargeDate ||
      cur.nextAppointmentDate !== orig.nextAppointmentDate ||
      cur.recordColor !== orig.recordColor ||
      cur.nextAppointmentColor !== orig.nextAppointmentColor ||
      cur.petId !== orig.petId ||
      a !== b
    );
  }, []);

  // 1) mount-time draft check — ready 가 true 가 되는 첫 시점에 1회.
  useEffect(() => {
    if (!ready || !userId || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const key = getKey(variant, userId, recordId);
    const sessionKey = getSessionKey(variant, recordId);
    const draft = loadDraft(key, { serverUpdatedAt: serverUpdatedAt ?? undefined });
    let sameSession = false;
    try { sameSession = sessionStorage.getItem(sessionKey) === '1'; } catch {}
    if (draft) {
      if (sameSession) {
        // 같은 세션 — 모달 없이 자동 복원. setIsDirty 는 호출 X.
        // edit 의 경우 state-vs-origin 비교 useEffect 가 자동 dirty 켜줌.
        // add 의 경우 호출부 form onChange 가 dirty 켜줌 (record origin 없음).
        onApplyRef.current(draft);
      } else {
        setPendingDraft(draft);
      }
    }
    try { sessionStorage.setItem(sessionKey, '1'); } catch {}
  }, [ready, userId, recordId, variant, serverUpdatedAt]);

  // 2) edit: state vs origin 비교 → 자동 dirty.
  // form onChange 가 일부 환경에서 fire 안 되는 케이스 cover.
  // add 는 recordOrigin 없어서 effect 자체가 no-op.
  useEffect(() => {
    if (!ready || variant !== 'edit') return;
    // savedRef=true(저장/명시적 나가기 직후)면 divergence 재검출로 dirty 를 되살리지 않는다.
    //   ← 저장 후 origin 이 옛값이면 hasFormDiverged 가 계속 true → dirty 부활 → savedRef 리셋 →
    //     즉시-저장 effect 가 draft 를 재생성 → 재진입 시 "불러오기" 모달 오탐. 이 가드로 차단.
    //     사용자가 폼을 다시 만지면 setIsDirty(true) 래퍼가 savedRef 를 false 로 리셋해
    //     onChange race 안전망은 그대로 복구됨(정상 미저장 복원 모달엔 영향 없음).
    if (!isDirtyRef.current && !savedRef.current && hasFormDiverged()) {
      setIsDirty(true);  // wrapper 가 savedRef.current = false 자동 reset
    }
  }, [ready, variant, formState, hasFormDiverged, setIsDirty]);

  // 3) saveDraft 즉시 — formState 변화 + isDirty true 시 동기 저장.
  useEffect(() => {
    if (!ready || !userId || pendingDraft || !isDirty) return;
    if (savedRef.current) return;  // 저장 직후엔 재생성 차단
    const key = getKey(variant, userId, recordId);
    saveDraft(key, stateRef.current);
  }, [ready, userId, recordId, variant, pendingDraft, isDirty, formState]);

  // 4) 백그라운드 안전망 — pagehide / visibility hidden 시 강제 저장.
  // IME 안전망(captureFocusedInputValue): focused input/textarea DOM value override.
  useEffect(() => {
    if (!ready || !userId) return;
    const key = getKey(variant, userId, recordId);
    const save = () => {
      // 저장 성공 후 navigate 시 pagehide 가 발생하는데, 그 시점 hasFormDiverged
      // 는 여전히 true (recordOrigin 은 옛값) → save 호출되어 draft 가 다시 만들어짐.
      // savedRef 가 이 race 를 차단.
      if (savedRef.current) return;
      if (pendingDraftRef.current) return;
      const diverged = variant === 'edit' ? hasFormDiverged() : false;
      if (!isDirtyRef.current && !diverged) return;
      const snapshot = captureFocusedInputValue(stateRef.current);
      saveDraft(key, snapshot);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
    };
  }, [ready, userId, recordId, variant, hasFormDiverged]);

  // 5) 모달 [불러오기] — onApplyDraft 호출 + dirty 켜기 (명시).
  const applyDraft = useCallback(() => {
    if (!pendingDraft) return;
    onApplyRef.current(pendingDraft);
    setIsDirty(true);
    setPendingDraft(null);
  }, [pendingDraft]);

  // 6) 모달 [새로 시작] — draft 삭제 + 모달 닫기. 세션 마커는 그대로 유지.
  const discardDraft = useCallback(() => {
    if (userId) {
      const key = getKey(variant, userId, recordId);
      clearDraft(key);
    }
    setPendingDraft(null);
  }, [userId, recordId, variant]);

  // 7) 저장 성공 / 나가기 시 — draft + 세션 마커 정리 + isDirty 해제 + savedRef set.
  // savedRef 가 true 가 되면 이후 pagehide / 즉시 save useEffect 둘 다 차단되어
  // navigate 직전 race 로 draft 가 다시 만들어지는 버그 방지.
  const clearDraftAndSession = useCallback(() => {
    if (userId) {
      const key = getKey(variant, userId, recordId);
      clearDraft(key);
    }
    const sessionKey = getSessionKey(variant, recordId);
    try { sessionStorage.removeItem(sessionKey); } catch {}
    savedRef.current = true;
    setIsDirtyState(false);
  }, [userId, recordId, variant]);

  return {
    isDirty,
    setIsDirty,
    pendingDraft,
    applyDraft,
    discardDraft,
    clearDraftAndSession,
  };
}
