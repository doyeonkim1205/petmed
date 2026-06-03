'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import {
  User, Settings, Bell, LogOut, ChevronRight, Edit2,
  X, Plus, Trash2, Dog, Cat, Moon, Sun, Type, Heart, Bookmark, Crown,
  Globe, Trash, Info, Clock, Shield, Eye, FileText, UserX, AlertTriangle,
  CreditCard, MapPin, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { NotificationPermissionDenied } from '@/components/NotificationPermissionDenied';
import { APP_VERSION } from '@/lib/version';
import { ConfirmModal } from '@/components/ConfirmModal';
import { TextField } from '@/components/TextField';
import { PetFormFields } from '@/components/pets/PetFormFields';
import {
  PetFormState, EMPTY_PET_FORM, petToForm, formToPayload, validatePetForm,
} from '@/lib/petForm';

// ─── Nickname Edit Modal ───────────────────────────────────
function NicknameModal({
  open, currentNickname, onClose, onSave,
}: {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<{ error: Error | null }>;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { setNickname(currentNickname); setErrorMsg(''); }, [currentNickname]);

  if (!open) return null;

  // 한글(완성형+자음모음) · 영문 · 숫자 · '_' · '-' 만 허용. 특수문자/이모지/공백 차단.
  // 입력 단계에서 막으면 사용자가 못 친 이유를 알기 어려우니, 자동으로 허용 문자만 통과.
  const sanitize = (raw: string) => raw.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '');

  const handleSave = async () => {
    const clean = sanitize(nickname).trim();
    if (clean.length < 1) {
      setErrorMsg('닉네임을 입력해주세요');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    const result = await onSave(clean);
    setSaving(false);
    if (result.error) {
      setErrorMsg(result.error.message || '저장에 실패했습니다');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">닉네임 변경</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <TextField
          value={nickname}
          onChange={e => setNickname(sanitize(e.target.value))}
          placeholder="한글·영문·숫자 (1~10자)"
          autoComplete="nickname"
          maxLength={10}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-2"
        />
        {errorMsg && (
          <p className="text-red-500 text-xs mb-2">{errorMsg}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || nickname.trim().length < 1}
            className="flex-1 h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pet Management Modal ──────────────────────────────────
// 펫 등록·편집·삭제 모달.
// 2026-05 확장: AI 증상 분석 컨텍스트 필드 (성별, 중성화, 체중, 만성질환) 추가.
//   - 모두 선택 입력 — 사용자가 점진적으로 채울 수 있게.
//   - DB 에 NULL 로 들어가도 기존 기능 영향 0 (옛 펫은 그대로 유지).
// 편집 모드: 펫 카드 옆 ✏️ 버튼으로 진입 → 같은 폼 재사용.
// 폼 상태/변환 로직(petForm)과 입력 필드 UI(PetFormFields)는 공통 모듈로 분리 —
// 기록장 첫 진입 화면과 입력 항목을 동기화하기 위함.

function PetModal({
  open, userId, onClose,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);   // null = 신규, 값 = 편집 중인 펫 id
  const [form, setForm] = useState<PetFormState>(EMPTY_PET_FORM);
  const [saving, setSaving] = useState(false);
  // 더블 클릭 방지용 동기적 lock — setSaving 은 setState 라 다음 렌더 사이클에서야
  // disabled 가 적용되므로 빠른 더블 클릭이면 두 번 호출됨. useRef 로 즉시 차단.
  const savingRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  // 등록 한도 초과 안내 모달 (기존 native alert 대체)
  const [limitMsg, setLimitMsg] = useState<React.ReactNode | null>(null);

  const fetchPets = useCallback(async () => {
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      console.warn('PetModal: fetch timed out after 5s');
    }, 5000);
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPets(data ?? []);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'pets', action: 'fetch' },
        extra: { userId },
      });
      console.error('Error fetching pets:', err);
      setPets([]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (open) fetchPets(); }, [open, fetchPets]);

  if (!open) return null;

  const closeForm = () => {
    setShowForm(false);
    setEditingPetId(null);
    setForm(EMPTY_PET_FORM);
    setFormError(null);
  };

  const openAddForm = () => {
    setEditingPetId(null);
    setForm(EMPTY_PET_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (pet: Pet) => {
    setEditingPetId(pet.id);
    setForm(petToForm(pet));
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    // 동기적 lock — 빠른 더블 클릭으로 중복 INSERT 되는 것 방지.
    // 검증 실패는 lock 해제하지만, 실제 네트워크 호출 시작 후엔 응답 완료까지 lock 유지.
    if (savingRef.current) return;
    setFormError(null);
    const validationError = validatePetForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = formToPayload(form);
    savingRef.current = true;
    setSaving(true);

    try {
      if (editingPetId) {
        const { error } = await supabase
          .from('pets')
          .update(payload)
          .eq('id', editingPetId)
          .eq('user_id', userId);
        if (error) {
          Sentry.captureException(error, { tags: { feature: 'pets', action: 'update' } });
          setFormError('저장에 실패했습니다. 다시 시도해주세요.');
          return;
        }
        logActivity(userId, 'pet.update', { resourceType: 'pet', resourceId: editingPetId });
        // 홈 브리핑 캐시 무효화 — 펫 이름/생일/체중 변경이 헤더 표시에 영향
        const { invalidateHealthBriefing } = await import('@/lib/swrCache');
        invalidateHealthBriefing(userId);
        closeForm();
        fetchPets();
        return;
      }

      // 신규 등록 — 한도 체크 + INSERT
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();
      const effectivePlan = getEffectivePlan(profile?.plan);
      const config = getPlanConfig(effectivePlan);
      if (config.maxPets > 0 && pets.length >= config.maxPets) {
        setLimitMsg(
          effectivePlan !== 'free' ? (
            <>반려동물 등록 한도({config.maxPets}마리)에 도달했습니다.<br />추가 용량이 필요하시면 문의해 주세요.</>
          ) : (
            <>반려동물은 {config.maxPets}마리까지 등록할 수 있어요<br />Plus로 업그레이드하여 더 많은 반려동물을 등록하세요</>
          ),
        );
        return;
      }

      const { data, error } = await supabase
        .from('pets')
        .insert({ user_id: userId, ...payload })
        .select('id')
        .single();
      if (error) {
        Sentry.captureException(error, { tags: { feature: 'pets', action: 'create' } });
        setFormError('등록에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      if (data) logActivity(userId, 'pet.create', { resourceType: 'pet', resourceId: data.id });
      // 홈 브리핑 캐시 무효화 — 새 펫이 즉시 카드에 반영되도록.
      {
        const { invalidateHealthBriefing } = await import('@/lib/swrCache');
        invalidateHealthBriefing(userId);
      }
      closeForm();
      fetchPets();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (petId: string) => {
    await supabase.from('pets').delete().eq('id', petId).eq('user_id', userId);
    logActivity(userId, 'pet.delete', { resourceType: 'pet', resourceId: petId });
    // 홈 브리핑 캐시 무효화 — 삭제된 펫이 카드에서 즉시 제거되도록.
    const { invalidateHealthBriefing } = await import('@/lib/swrCache');
    invalidateHealthBriefing(userId);
    fetchPets();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">나의 반려동물</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8 text-sm">로딩 중...</p>
          ) : pets.length === 0 && !showForm ? (
            <p className="text-gray-400 text-center py-8 text-sm">등록된 반려동물이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {pets.map(pet => (
                <div key={pet.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    {pet.type === 'dog' ? <Dog size={16} /> : <Cat size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-700 truncate">{pet.name}</p>
                  </div>
                  <button
                    onClick={() => openEditForm(pet)}
                    aria-label="수정"
                    className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: pet.id, name: pet.name })}
                    aria-label="삭제"
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {editingPetId ? '반려동물 정보 수정' : '반려동물 추가'}
              </p>

              <PetFormFields form={form} setForm={setForm} />

              {formError && (
                <p className="text-xs text-red-500">{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeForm}
                  className="flex-1 h-9 border border-gray-200 rounded-full text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 h-9 bg-blue-600 text-[#fff] rounded-full text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? (editingPetId ? '저장 중...' : '등록 중...') : (editingPetId ? '저장' : '등록')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 pt-3">
          {!showForm && (
            <button
              onClick={openAddForm}
              className="w-full h-9 flex items-center justify-center gap-1.5 border border-dashed border-gray-200 rounded-full text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={14} /> 반려동물 추가
            </button>
          )}
        </div>
      </div>
      <ConfirmModal
        open={deleteTarget !== null}
        title="반려동물을 삭제할까요?"
        message={<>{deleteTarget?.name ?? ''}의 건강기록도 함께 삭제돼요.<br />되돌릴 수 없어요.</>}
        variant="danger"
        confirmLabel="삭제"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={limitMsg !== null}
        title="등록 한도에 도달했어요"
        message={limitMsg}
        confirmLabel="확인"
        hideCancel
        onConfirm={() => setLimitMsg(null)}
        onCancel={() => setLimitMsg(null)}
      />
    </div>
  );
}

// ─── Notification Settings Modal ───────────────────────────
function NotificationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [debugMode, setDebugMode] = useState(false);
  const [deniedModalOpen, setDeniedModalOpen] = useState(false);
  const [iosInstallHintOpen, setIosInstallHintOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (typeof window !== 'undefined') {
      // URL 쿼리 또는 localStorage 에 debugPush 설정 시 활성
      const urlOn = new URLSearchParams(window.location.search).get('debugPush') === '1';
      const storageOn = localStorage.getItem('debugPush') === '1';
      setDebugMode(urlOn || storageOn);
    }
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    if (!supported) return;

    // 모달 오픈 시 self-healing:
    //   permission='granted' + 구독 없음 → 그 자리에서 조용히 subscribe 시도.
    //   AuthContext 의 auto-resub 가 타이밍 race / 일시 실패로 놓친 케이스를
    //   여기서 복구 → 사용자가 "토글이 OFF 로 보이는데 분명 허용했는데?" 경험 제거.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (vapidKey) {
            const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
            const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const raw = atob(base64);
            const arr = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            try {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: arr,
              });
              // 서버에 endpoint 등록. 실패 시 sub 롤백.
              const json = sub.toJSON();
              const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
              if (session) {
                const res = await fetch('/api/push/subscribe', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ endpoint: json.endpoint, keys_p256dh: json.keys?.p256dh, keys_auth: json.keys?.auth }),
                });
                if (!res.ok) {
                  await sub.unsubscribe();
                  sub = null;
                } else {
                  // 의사 기록도 true 로 동기화 (auto-resub 가 놓친 케이스 보완)
                  try {
                    const { data: { user: u } } = await supabase.auth.getUser();
                    if (u) await supabase.from('profiles').update({ is_push_enabled: true }).eq('id', u.id);
                  } catch {}
                }
              }
            } catch {
              // 권한 관련 에러 등 — 무시하고 기존 sub 상태 유지
            }
          }
        }

        setPushEnabled(!!sub);
      } catch {
        // SW 접근 실패 등 — 초기 상태 유지
      }
    })();
  }, [open]);

  if (!open) return null;

  const log = (msg: string) => {
    // 콘솔에도 남기고 화면에도 누적
    console.log('[push]', msg);
    setDebugLog((prev) => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`]);
  };

  const handleTogglePush = async (enabled: boolean) => {
    // Free 유저는 "알림 설정" 버튼에서 이미 showAlarmUpgrade 모달로 차단됨 (여기까지 도달 안 함)
    // Samsung Internet 유료 유저: 켜는 방향이면 사전 차단 (SPS 제약으로 알림 수신 불안정)
    if (enabled && /SamsungBrowser/i.test(navigator.userAgent)) {
      setDeniedModalOpen(true);
      return;
    }
    // iOS + 홈 화면 미설치: 푸시가 구조적으로 불가 → 간결한 안내만 띄움
    if (enabled) {
      const { detectDevice } = await import('@/lib/deviceDetect');
      const device = detectDevice();
      if (device?.isIos && !device.isStandalone) {
        setIosInstallHintOpen(true);
        return;
      }
    }
    setPushLoading(true);
    setDebugLog([]);
    log(`toggle=${enabled}, UA=${navigator.userAgent.slice(0, 60)}`);
    log(`Notification.permission=${Notification.permission}`);
    try {
      if (enabled) {
        log('Step 1: requestPermission()');
        const permission = await Notification.requestPermission();
        log(`  → permission=${permission}`);
        if (permission !== 'granted') {
          // 'denied' 면 안내 모달 표시 (유저가 차단 해제 방법을 알 수 있도록)
          if (permission === 'denied') setDeniedModalOpen(true);
          setPushLoading(false);
          return;
        }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        log(`Step 2: VAPID key ${vapidKey ? 'present (' + vapidKey.length + ' chars)' : 'MISSING'}`);
        if (!vapidKey) { setPushLoading(false); return; }

        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        log(`  → applicationServerKey Uint8Array(${arr.length})`);

        log('Step 3: serviceWorker.ready');
        const reg = await navigator.serviceWorker.ready;
        log(`  → SW scope=${reg.scope}`);

        log('Step 4: pushManager.subscribe()');
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr });
        const json = sub.toJSON();
        log(`  → endpoint=${(json.endpoint || '').slice(0, 50)}...`);

        if (debugMode) {
          log('Step 5: SKIPPED (debug mode — free 유저도 테스트 가능)');
          await sub.unsubscribe();
          log('  → test subscription cleaned up');
        } else {
          log('Step 5: POST /api/push/subscribe');
          const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
          if (session) {
            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: json.endpoint, keys_p256dh: json.keys?.p256dh, keys_auth: json.keys?.auth }),
            });
            log(`  → status=${res.status} ${res.ok ? 'OK' : 'FAIL'}`);
            if (!res.ok) {
              const body = await res.text().catch(() => '');
              log(`  → body=${body.slice(0, 100)}`);
              await sub.unsubscribe();
              setPushLoading(false);
              return;
            }
          } else {
            log('  → no session, skipping server save');
          }
        }
        setPushEnabled(true);
        // DB 에 의사 기록 (기기 간 sync 용). 실패해도 구독 자체는 성공이라 무시.
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) await supabase.from('profiles').update({ is_push_enabled: true }).eq('id', u.id);
        } catch {}
        log('DONE: subscribed');
      } else {
        log('Unsubscribe flow');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
          if (session) {
            await fetch('/api/push/subscribe', {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          }
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        // DB 에 명시적 OFF 기록 (auto-resub 가 다시 켜지 않도록).
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) await supabase.from('profiles').update({ is_push_enabled: false }).eq('id', u.id);
        } catch {}
        log('DONE: unsubscribed');
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'push', action: 'toggle' },
      });
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      log(`ERROR: ${msg}`);
      console.error('Push toggle failed:', err);
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-gray-700">알림 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          {pushSupported ? (
            <>
              <ToggleRow
                label="푸시 알림"
                desc={pushLoading ? '설정 중...' : pushEnabled ? '투약, 예약일, 퇴원일 알림을 받습니다' : '알림이 꺼져 있습니다'}
                checked={pushEnabled}
                onChange={handleTogglePush}
              />
              {!pushEnabled && !pushLoading && (
                <p className="text-[11px] text-gray-400 -mt-2 pl-1">
                  알림을 켜면 투약 시간, 예약일, 퇴원일에 푸시 알림을 받을 수 있습니다.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              이 브라우저에서는 푸시 알림을 지원하지 않습니다.<br />
              PWA를 설치하면 알림을 받을 수 있습니다.
            </p>
          )}
        </div>
        {debugMode && debugLog.length > 0 && (
          <div className="mt-4 p-2 bg-gray-900 text-green-300 text-[10px] rounded-md max-h-48 overflow-auto font-mono leading-relaxed">
            {debugLog.map((line, i) => (
              <div key={i} className="break-all">{line}</div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="w-full h-10 mt-5 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors">확인</button>
      </div>
      <NotificationPermissionDenied open={deniedModalOpen} onClose={() => setDeniedModalOpen(false)} />
      {iosInstallHintOpen && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={() => setIosInstallHintOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-2">알림을 받으려면 앱을 설치해야 해요</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              iOS 에서는 홈 화면에 추가한 뒤에만 푸시 알림을 받을 수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIosInstallHintOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setIosInstallHintOpen(false);
                  onClose();
                  window.dispatchEvent(new Event('show-ios-install'));
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium"
              >
                설치 방법 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Settings Modal (Full Featured) ─────────────────────
function AppSettingsModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [language, setLanguage] = useState('ko');
  const [autoLogin, setAutoLogin] = useState(true);
  const [highContrast, setHighContrast] = useState(true);
  const [defaultPetId, setDefaultPetId] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (open) {
      setDarkMode(document.documentElement.classList.contains('dark'));
      setFontSize(localStorage.getItem('fontSize') || '16');
      setLanguage(localStorage.getItem('language') || 'ko');
      setAutoLogin(localStorage.getItem('autoLogin') !== 'false');
      setHighContrast(localStorage.getItem('highContrast') !== 'false');
      setDefaultPetId(localStorage.getItem('defaultPetId') || '');
      // Fetch pets for default pet selector
      supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .then(({ data }) => setPets(data || []));
    }
  }, [open, userId]);

  if (!open) return null;

  const handleDarkToggle = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleHighContrastToggle = (enabled: boolean) => {
    setHighContrast(enabled);
    if (enabled) {
      document.documentElement.classList.add('high-contrast');
      localStorage.setItem('highContrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      localStorage.setItem('highContrast', 'false');
    }
  };

  const handleFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
    document.documentElement.style.fontSize = `${size}px`;
  };

  const handleAutoLogin = (enabled: boolean) => {
    setAutoLogin(enabled);
    localStorage.setItem('autoLogin', String(enabled));
  };

  const handleDefaultPet = (petId: string) => {
    setDefaultPetId(petId);
    if (petId) {
      localStorage.setItem('defaultPetId', petId);
    } else {
      localStorage.removeItem('defaultPetId');
    }
  };

  const fontSizes = [
    { value: '14', label: '작게' },
    { value: '16', label: '보통' },
    { value: '18', label: '크게' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">앱 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {/* Dark Mode */}
          <div>
            <SectionHeader icon={darkMode ? Moon : Sun} iconColor={darkMode ? 'text-blue-500' : 'text-orange-400'} label="화면 모드" />
            <ToggleRow label="다크 모드" desc="어두운 배경으로 눈의 피로를 줄입니다" checked={darkMode} onChange={handleDarkToggle} />
          </div>

          {/* Font Size */}
          <div>
            <SectionHeader icon={Type} iconColor="text-gray-400" label="글자 크기" />
            <div className="flex gap-2">
              {fontSizes.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => handleFontSize(fs.value)}
                  className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                    fontSize === fs.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default Pet */}
          {pets.length > 0 && (
            <div>
              <SectionHeader icon={Dog} iconColor="text-gray-400" label="기본 반려동물" />
              <p className="text-[11px] text-gray-400 mb-2">기록장 진입 시 자동 선택됩니다</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleDefaultPet('')}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    defaultPetId === '' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  전체
                </button>
                {pets.map((pet) => {
                  const Icon = pet.type === 'cat' ? Cat : Dog;
                  return (
                    <button
                      key={pet.id}
                      onClick={() => handleDefaultPet(pet.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        defaultPetId === pet.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      <Icon size={12} />
                      {pet.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto Login */}
          <div>
            <SectionHeader icon={Shield} iconColor="text-gray-400" label="보안" />
            <ToggleRow label="자동 로그인" desc="앱 재시작 시 자동으로 로그인합니다" checked={autoLogin} onChange={handleAutoLogin} />
          </div>

          {/* Accessibility */}
          <div>
            <SectionHeader icon={Eye} iconColor="text-gray-400" label="접근성" />
            <ToggleRow label="고대비 모드" desc="텍스트와 버튼의 대비를 높입니다" checked={highContrast} onChange={handleHighContrastToggle} />
          </div>

          {/* Language */}
          <div>
            <SectionHeader icon={Globe} iconColor="text-gray-400" label="언어" />
            <div className="flex gap-2">
              <button
                onClick={() => { setLanguage('ko'); localStorage.setItem('language', 'ko'); }}
                className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                  language === 'ko' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => { setLanguage('en'); localStorage.setItem('language', 'en'); }}
                className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                  language === 'en' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                English
              </button>
            </div>
            {language === 'en' && (
              <p className="text-[11px] text-orange-500 mt-2">영어 지원은 준비 중입니다.</p>
            )}
          </div>

          {/* Cache Management */}
          <div>
            <SectionHeader icon={Trash} iconColor="text-gray-400" label="캐시 관리" />
            <button
              onClick={() => {
                try { localStorage.removeItem('pawdex_translation_cache'); } catch {}
                try { sessionStorage.clear(); } catch {}
                alert('캐시가 삭제되었습니다.');
              }}
              className="w-full h-9 rounded-full border border-gray-200 text-xs font-medium text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              캐시 삭제
            </button>
            <p className="text-[10px] text-gray-400 mt-1">검색 결과, 번역 등 임시 데이터를 정리합니다.</p>
          </div>

          {/* App Info */}
          <div>
            <SectionHeader icon={Info} iconColor="text-gray-400" label="앱 정보" />
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between"><span>버전</span><span className="text-gray-600">{APP_VERSION}</span></div>
              <div className="flex justify-between"><span>개발</span><span className="text-gray-600">PawDex Team</span></div>
            </div>
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="w-full h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors">확인</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────
function SectionHeader({ icon: Icon, iconColor, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; iconColor: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={14} className={iconColor} />
      <span className="text-xs font-semibold text-gray-600">{label}</span>
    </div>
  );
}

// ─── Toggle Row Component ──────────────────────────────────
function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5.5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
        style={{ width: 40, height: 22 }}
      >
        <span className={`absolute top-0.5 w-[18px] h-[18px] bg-[#fff] rounded-full shadow transition-transform ${
          checked ? 'left-[20px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────
const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'expectation_gap', label: '서비스가 기대와 달라요' },
  { value: 'price', label: '가격이 부담돼요' },
  { value: 'low_usage', label: '사용 빈도가 낮아요' },
  { value: 'switching', label: '다른 앱으로 전환해요' },
  { value: 'privacy', label: '개인정보가 걱정돼요' },
  { value: 'other', label: '기타' },
];

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setErrorMsg('');
      setReason('');
      setReasonDetail('');
    }
  }, [open]);

  if (!open) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('세션이 만료되었습니다.');

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || null,
          reasonDetail: reasonDetail.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '삭제 실패');

      // Clear all local state and redirect
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.startsWith('pawdex_')) localStorage.removeItem(key);
        });
      } catch {}
      window.location.href = '/';
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'account', action: 'delete' },
      });
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex flex-col items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">정말 탈퇴하시겠어요?</h3>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            모든 데이터가 <span className="text-red-400 font-medium">영구 삭제</span>되며<br />복구할 수 없습니다.
          </p>
        </div>

        <div className="mb-3">
          <p className="text-[11px] text-gray-500 mb-1.5">탈퇴 이유 <span className="text-gray-300">(선택)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReason(reason === opt.value ? '' : opt.value)}
                className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                  reason === opt.value
                    ? 'bg-red-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {reason === 'other' && (
            <TextField
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value.slice(0, 100))}
              placeholder="자세한 사유를 입력해주세요 (선택)"
              className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none"
            />
          )}
        </div>

        <div className="mb-4">
          <p className="text-[11px] text-gray-400 mb-1.5">확인을 위해 <span className="font-bold text-gray-600">&quot;탈퇴합니다&quot;</span>를 입력해주세요.</p>
          <TextField
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="탈퇴합니다"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>

        {errorMsg && <p className="text-red-500 text-xs mb-3">{errorMsg}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== '탈퇴합니다'}
            className="flex-1 h-10 bg-red-500 text-[#fff] rounded-full text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {deleting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Profile Page ─────────────────────────────────────
export default function ProfilePage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const router = useRouter();

  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);

  const canUseAlarm = isPWA && getEffectivePlan(profile?.plan) === 'plus';

  useEffect(() => {
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  // 모달 열릴 때 히스토리 추가, 뒤로가기 시 모달 닫기
  const modalOpenRef = useRef(false);
  const anyModalOpen = showNicknameModal || showPetModal || showNotificationModal || showSettingsModal || showDeleteModal || showAlarmUpgrade;

  useEffect(() => {
    if (anyModalOpen && !modalOpenRef.current) {
      modalOpenRef.current = true;
      window.history.pushState({ modal: true }, '');
    } else if (!anyModalOpen && modalOpenRef.current) {
      modalOpenRef.current = false;
    }
  }, [anyModalOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (anyModalOpen) {
        setShowNicknameModal(false);
        setShowPetModal(false);
        setShowNotificationModal(false);
        setShowSettingsModal(false);
        setShowDeleteModal(false);
        setShowAlarmUpgrade(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [anyModalOpen]);

  const handleLogout = async () => {
    // Remove this device session from DB (maxDevices tracking)
    try {
      const { getDeviceId } = await import('@/lib/deviceId');
      const { authFetch } = await import('@/lib/authFetch');
      const device_id = getDeviceId();
      await authFetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id }),
      });
    } catch {}
    // Clear auth data from localStorage (검색 기록은 사용자별로 유지)
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem('pawdex_translation_cache');
    } catch {}
    // Clear session storage (검색 결과 캐시)
    try { sessionStorage.clear(); } catch {}
    // Full page reload — AuthContext.init() will find no session → show login
    window.location.href = '/';
  };

  const handleSaveNickname = async (nickname: string) => {
    return await updateProfile({ nickname });
  };

  if (loading) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] animate-pulse p-6 max-w-sm mx-auto">
        <div className="flex flex-col items-center pt-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full" />
          <div className="h-5 bg-gray-100 rounded w-24 mt-4" />
          <div className="h-4 bg-gray-50 rounded w-40 mt-2" />
        </div>
      </div>
    );
  }

  // (main) 레이아웃에서 미인증 유저를 /login 으로 리다이렉트함 → 여기 도달 시 user 는 항상 있음
  // 단 TypeScript 가 user 의 non-null 을 추론 못하므로 이 가드로 타입 narrowing
  if (!user) return null;

  return (
    <div className="bg-white min-h-[calc(100vh-8rem)]">
      {/* Profile Header */}
      <div className="max-w-sm mx-auto px-4 pt-8 pb-6">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3 overflow-hidden">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"

              />
            ) : (
              <User size={28} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">
              {profile?.nickname || '사용자'}
            </h2>
            <button
              onClick={() => setShowNicknameModal(true)}
              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
            >
              <Edit2 size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          {getEffectivePlan(profile?.plan) === 'plus' ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              <Crown size={10} /> Plus
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Menu List */}
      <div className="max-w-sm mx-auto px-4 space-y-1">
        {/* Pet Management */}
        <button
          onClick={() => setShowPetModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Heart size={18} className="text-pink-400" />
            <span className="text-sm">나의 반려동물</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Saved Analyses */}
        <Link
          href="/profile/saved"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Bookmark size={18} className="text-blue-400" />
            <span className="text-sm">내 보관함</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* 알림 설정 */}
        <button
          onClick={() => canUseAlarm ? setShowNotificationModal(true) : setShowAlarmUpgrade(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Bell size={18} className="text-gray-400" />
            <span className="text-sm">알림 설정</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Settings size={18} className="text-gray-400" />
            <span className="text-sm">앱 설정</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        <Link
          href="/profile/subscription"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <CreditCard size={18} className="text-blue-400" />
            <span className="text-sm">구독/결제 관리</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        {/* 약관 및 정책 */}
        <Link
          href="/policies"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <FileText size={18} className="text-gray-400" />
            <span className="text-sm">약관 및 정책</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        <button
          onClick={handleLogout}
          className="w-full px-4 py-3.5 flex items-center rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-red-400">
            <LogOut size={18} />
            <span className="text-sm">로그아웃</span>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full px-4 py-3.5 flex items-center rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-300">
            <UserX size={18} />
            <span className="text-sm">회원 탈퇴</span>
          </div>
        </button>
      </div>

      <div className="py-8 px-6 text-center">
        <div className="text-[10px] text-gray-300 leading-relaxed">
          <p>디와이랩스(DYLabs) | 대표: 김도연</p>
          <p>사업자등록번호: 769-77-00552</p>
          <p>통신판매업신고번호: 2026-화성동탄-1654</p>
          <p>경기도 화성시 동탄순환대로 26길 81</p>
          <p>010-8306-9687 | dylabs.pawdex@gmail.com</p>
        </div>
      </div>

      {/* Modals */}
      <NicknameModal
        open={showNicknameModal}
        currentNickname={profile?.nickname || ''}
        onClose={() => setShowNicknameModal(false)}
        onSave={handleSaveNickname}
      />
      <PetModal
        open={showPetModal}
        userId={user.id}
        onClose={() => setShowPetModal(false)}
      />
      <NotificationModal
        open={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
      <AppSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userId={user.id}
      />
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />

      {/* 알림 기능 안내 팝업 — 상황별 문구 */}
      {showAlarmUpgrade && (() => {
        const isFree = getEffectivePlan(profile?.plan) === 'free';
        const needApp = !isPWA;
        const needPlus = isFree;

        let message = '';
        let buttonLabel = '';
        let buttonAction = () => { setShowAlarmUpgrade(false); };

        if (needApp && needPlus) {
          message = '앱을 설치하고 Plus로 업그레이드하면 알림을 사용할 수 있어요.';
          buttonLabel = '구독/결제 관리';
          buttonAction = () => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); };
        } else if (needApp && !needPlus) {
          message = '앱을 설치하면 알림을 사용할 수 있어요. 홈 화면에 추가해주세요.';
          buttonLabel = '확인';
        } else if (!needApp && needPlus) {
          message = 'Plus로 업그레이드하면 알림을 사용할 수 있어요.';
          buttonLabel = '구독/결제 관리';
          buttonAction = () => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); };
        }

        return (
          <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">알림 기능</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1">{message}</p>
              <p className="text-xs text-gray-400 mb-4">투약 시간, 예약일, 퇴원일에 푸시 알림을 보내드려요.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAlarmUpgrade(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  닫기
                </button>
                <button onClick={buttonAction}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  {buttonLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
