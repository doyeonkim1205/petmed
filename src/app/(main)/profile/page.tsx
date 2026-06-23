'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { logActivity } from '@/lib/activityLog';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { isNativeApp, registerNativePush, unregisterNativePush, isNativePushRegistered } from '@/lib/platform';
import {
  User, Settings, Bell, LogOut, ChevronRight, Edit2,
  X, Plus, Trash2, Dog, Cat, Moon, Sun, Type, Heart, Bookmark, Crown,
  Globe, Info, Clock, Shield, Eye, FileText, UserX, AlertTriangle,
  CreditCard, MapPin, Building2, HardDrive, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { NotificationPermissionDenied } from '@/components/NotificationPermissionDenied';
import { APP_VERSION } from '@/lib/version';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LOCALE_COOKIE } from '@/i18n/config';
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
  const t = useTranslations();
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
      setErrorMsg(t('profile.nickname.empty'));
      return;
    }
    setSaving(true);
    setErrorMsg('');
    const result = await onSave(clean);
    setSaving(false);
    if (result.error) {
      setErrorMsg(result.error.message || t('profile.nickname.saveFailed'));
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">{t('profile.nickname.title')}</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <TextField
          value={nickname}
          onChange={e => setNickname(sanitize(e.target.value))}
          placeholder={t('profile.nickname.placeholder')}
          autoComplete="nickname"
          maxLength={10}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-2"
        />
        {errorMsg && (
          <p className="text-red-500 text-xs mb-2">{errorMsg}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={saving || nickname.trim().length < 1}
            className="flex-1 h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? t('record.form.saving') : t('common.save')}
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
  const t = useTranslations();
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
      setPets(sortPetsWithDefault(data ?? [], readDefaultPetId()));
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
          setFormError(t('profile.pet.saveFailed'));
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
          effectivePlan !== 'free'
            ? t.rich('profile.pet.limitPaid', { max: config.maxPets, br: () => <br /> })
            : t.rich('profile.pet.limitFree', { max: config.maxPets, br: () => <br /> }),
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
        setFormError(t('profile.pet.createFailed'));
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
    // Optimistic update — UI 먼저 갱신해 fetchPets 의 로딩 스피너로 인한 카드 깜빡임/흔들림 방지.
    setPets(prev => prev.filter(p => p.id !== petId));
    await supabase.from('pets').delete().eq('id', petId).eq('user_id', userId);
    logActivity(userId, 'pet.delete', { resourceType: 'pet', resourceId: petId });
    // 홈 브리핑 캐시 무효화 — 삭제된 펫이 카드에서 즉시 제거되도록.
    const { invalidateHealthBriefing } = await import('@/lib/swrCache');
    invalidateHealthBriefing(userId);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">{t('profile.pet.title')}</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8 text-sm">{t('profile.pet.loading')}</p>
          ) : pets.length === 0 && !showForm ? (
            <p className="text-gray-400 text-center py-8 text-sm">{t('profile.pet.empty')}</p>
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
                    aria-label={t('profile.pet.editAria')}
                    className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: pet.id, name: pet.name })}
                    aria-label={t('profile.pet.deleteAria')}
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
                {editingPetId ? t('profile.pet.editTitle') : t('profile.pet.addTitle')}
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
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 h-9 bg-blue-600 text-[#fff] rounded-full text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? (editingPetId ? t('record.form.saving') : t('profile.pet.savingNew')) : (editingPetId ? t('common.save') : t('profile.pet.register'))}
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
              <Plus size={14} /> {t('profile.pet.addTitle')}
            </button>
          )}
        </div>
      </div>
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('profile.pet.deleteTitle')}
        message={t.rich('profile.pet.deleteMsg', { name: deleteTarget?.name ?? '', br: () => <br /> })}
        variant="danger"
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={limitMsg !== null}
        title={t('profile.pet.limitTitle')}
        message={limitMsg}
        confirmLabel={t('common.confirm')}
        hideCancel
        onConfirm={() => setLimitMsg(null)}
        onCancel={() => setLimitMsg(null)}
      />
    </div>
  );
}

// ─── Notification Settings Modal ───────────────────────────
function NotificationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
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
    // 네이티브 앱: FCM 사용 → "지원됨"으로 표시하고 web SW self-healing 은 건너뜀.
    if (isNativeApp()) {
      setPushSupported(true);
      setPushEnabled(isNativePushRegistered());
      return;
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
    // 네이티브 앱: FCM 등록/해제 (web-push·Notification·ServiceWorker 경로 전부 건너뜀)
    if (isNativeApp()) {
      setPushLoading(true);
      try {
        let result = false;
        if (enabled) {
          result = await registerNativePush();
        } else {
          await unregisterNativePush();
        }
        setPushEnabled(result);
        try {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) await supabase.from('profiles').update({ is_push_enabled: result }).eq('id', u.id);
        } catch {}
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'push', action: 'toggle-native' } });
      } finally {
        setPushLoading(false);
      }
      return;
    }
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
          <h3 className="text-sm font-bold text-gray-700">{t('profile.notif.title')}</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          {pushSupported ? (
            <>
              <ToggleRow
                label={t('profile.notif.push')}
                desc={pushLoading ? t('profile.notif.settingUp') : pushEnabled ? t('profile.notif.descOn') : t('profile.notif.descOff')}
                checked={pushEnabled}
                onChange={handleTogglePush}
              />
              {!pushEnabled && !pushLoading && (
                <p className="text-[11px] text-gray-400 -mt-2 pl-1">
                  {t('profile.notif.hint')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              {t.rich('profile.notif.unsupported', { br: () => <br /> })}
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
        <button onClick={onClose} className="w-full h-10 mt-5 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors">{t('common.confirm')}</button>
      </div>
      <NotificationPermissionDenied open={deniedModalOpen} onClose={() => setDeniedModalOpen(false)} />
      {iosInstallHintOpen && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={() => setIosInstallHintOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('profile.notif.iosTitle')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-5 break-keep break-words">
              {t('profile.notif.iosDesc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIosInstallHintOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => {
                  setIosInstallHintOpen(false);
                  onClose();
                  window.dispatchEvent(new Event('show-ios-install'));
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium"
              >
                {t('profile.notif.iosInstallGuide')}
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
  const t = useTranslations();
  const currentLocale = useLocale() as Locale;
  // 언어는 "확인" 누르기 전엔 적용 안 함 — 선택만 보류했다가 확인 시 쿠키·계정 저장 후 새로고침.
  const [pendingLocale, setPendingLocale] = useState<Locale>(currentLocale);
  const [applyingLocale, setApplyingLocale] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [autoLogin, setAutoLogin] = useState(true);
  const [highContrast, setHighContrast] = useState(true);
  const [defaultPetId, setDefaultPetId] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);
  // 저장 공간 — /api/storage-usage 응답.
  const [storage, setStorage] = useState<{ usedMB: number; limitMB: number } | null>(null);

  useEffect(() => {
    if (open) {
      setPendingLocale(currentLocale); // 열 때마다 현재 언어로 초기화
      setDarkMode(document.documentElement.classList.contains('dark'));
      setFontSize(localStorage.getItem('fontSize') || '16');
      setAutoLogin(localStorage.getItem('autoLogin') !== 'false');
      setHighContrast(localStorage.getItem('highContrast') !== 'false');
      setDefaultPetId(localStorage.getItem('defaultPetId') || '');
      // Fetch pets for default pet selector
      supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .then(({ data }) => setPets(sortPetsWithDefault(data || [], localStorage.getItem('defaultPetId'))));
      // 저장 공간 사용량 fetch — 응답 전엔 storage=null (스피너), 실패해도 {0,0} 로 스피너 멈춤.
      (async () => {
        try {
          const { authFetch } = await import('@/lib/authFetch');
          const res = await authFetch('/api/storage-usage');
          if (res.ok) {
            const json = await res.json();
            setStorage({ usedMB: json.usedMB, limitMB: json.limitMB });
          } else {
            setStorage({ usedMB: 0, limitMB: 0 });
          }
        } catch {
          setStorage({ usedMB: 0, limitMB: 0 });
        }
      })();
    }
  }, [open, userId, currentLocale]);

  // "확인" 시: 언어가 바뀌었으면 쿠키 저장 + (로그인 시) 계정 동기화 후 새로고침. 아니면 그냥 닫기.
  const handleConfirm = () => {
    if (pendingLocale === currentLocale) { onClose(); return; }
    setApplyingLocale(true);
    // path=/ (전 경로), max-age 1년, SameSite=Lax. Secure 생략(로컬 http 개발 환경 대응).
    document.cookie = `${LOCALE_COOKIE}=${pendingLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    (async () => {
      try {
        await supabase.from('profiles').update({ preferred_language: pendingLocale }).eq('id', userId);
      } catch { /* 계정 동기화 실패해도 쿠키 기반 전환은 진행 */ }
      window.location.reload();
    })();
  };

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
    { value: '14', label: t('profile.settings.fontSmall') },
    { value: '16', label: t('profile.settings.fontNormal') },
    { value: '18', label: t('profile.settings.fontLarge') },
  ];

  // ─── 임시 숨김 플래그 ─────────────────────────────────────
  // 다크 모드: 일관성 fix 전까지 토글 숨김 (코드는 보존, 추후 부활 쉬움).
  // 언어: 현재 한국에서만 서비스 → 영어 토글 숨김.
  // 고대비: 토글만 숨김 — 기본 ON 으로 동작 중 (layout.tsx 가 hc !== 'false' 면 자동 ON).
  //         현재 모든 사용자가 고대비 ON 상태로 PawDex 외형 인식. 토글 노출 안 함.
  const SHOW_DARK_MODE = false;
  const SHOW_HIGH_CONTRAST = false;

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">{t('profile.settings.title')}</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {/* Dark Mode (현재 숨김) */}
          {SHOW_DARK_MODE && (
            <div>
              <SectionHeader icon={darkMode ? Moon : Sun} iconColor={darkMode ? 'text-blue-500' : 'text-orange-400'} label={t('profile.settings.displayMode')} />
              <ToggleRow label={t('profile.settings.darkMode')} desc={t('profile.settings.darkModeDesc')} checked={darkMode} onChange={handleDarkToggle} />
            </div>
          )}

          {/* 1. 기본 반려동물 */}
          {pets.length > 0 && (
            <div>
              <SectionHeader icon={Dog} iconColor="text-gray-400" label={t('profile.settings.defaultPet')} />
              <p className="text-[11px] text-gray-400 mb-2">{t('profile.settings.defaultPetDesc')}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleDefaultPet('')}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    defaultPetId === '' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {t('common.all')}
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

          {/* 2. 보안 */}
          <div>
            <SectionHeader icon={Shield} iconColor="text-gray-400" label={t('profile.settings.security')} />
            <ToggleRow label={t('profile.settings.autoLogin')} desc={t('profile.settings.autoLoginDesc')} checked={autoLogin} onChange={handleAutoLogin} />
          </div>

          {/* 3. 접근성 (현재 숨김 — 기본 ON 으로 자동 적용) */}
          {SHOW_HIGH_CONTRAST && (
            <div>
              <SectionHeader icon={Eye} iconColor="text-gray-400" label={t('profile.settings.accessibility')} />
              <ToggleRow label={t('profile.settings.highContrast')} desc={t('profile.settings.highContrastDesc')} checked={highContrast} onChange={handleHighContrastToggle} />
            </div>
          )}

          {/* 4. 글자 크기 */}
          <div>
            <SectionHeader icon={Type} iconColor="text-gray-400" label={t('profile.settings.fontSize')} />
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

          {/* 5. 언어 — 선택만 보류하고 "확인" 시 적용(쿠키 저장 후 새로고침). */}
          <div>
            <SectionHeader icon={Globe} iconColor="text-gray-400" label={t('profile.settings.language')} />
            <LanguageToggle value={pendingLocale} onChange={setPendingLocale} disabled={applyingLocale} />
          </div>

          {/* 6. 저장 공간 — 첨부 파일 사용량. 제목은 즉시 + 데이터 로딩 중엔 스피너. */}
          <div>
            <SectionHeader icon={HardDrive} iconColor="text-gray-400" label={t('profile.settings.storage')} />
            {storage === null ? (
              // 로딩 중 — 그래프 자리에 작은 스피너
              <div className="flex items-center justify-center py-2.5">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : storage.limitMB > 0 ? (() => {
              const pct = Math.min(100, Math.round((storage.usedMB / storage.limitMB) * 100));
              const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
              const labelColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-gray-500';
              const formatMB = (mb: number) => mb >= 1000 ? `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)}GB` : `${Math.round(mb)}MB`;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-xs ${labelColor}`}>{t('profile.settings.attachments')}</span>
                    <span className="text-xs">
                      <span className="font-semibold text-gray-700">{formatMB(storage.usedMB)}</span>
                      <span className="text-gray-400"> / {formatMB(storage.limitMB)}</span>
                      <span className="text-gray-400"> · {pct}%</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })() : (
              <p className="text-[11px] text-gray-400 text-center py-2">{t('profile.settings.storageFailed')}</p>
            )}
          </div>

          {/* 7. 앱 정보 */}
          <div>
            <SectionHeader icon={Info} iconColor="text-gray-400" label={t('profile.settings.appInfo')} />
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between"><span>{t('profile.settings.version')}</span><span className="text-gray-600">{APP_VERSION}</span></div>
            </div>
          </div>
        </div>

        <div className="p-5 pt-3">
          <button onClick={handleConfirm} disabled={applyingLocale} className="w-full h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors disabled:opacity-60">{t('common.confirm')}</button>
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
const REASON_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'expectation_gap', labelKey: 'profile.delete.reasonExpectationGap' },
  { value: 'price', labelKey: 'profile.delete.reasonPrice' },
  { value: 'low_usage', labelKey: 'profile.delete.reasonLowUsage' },
  { value: 'switching', labelKey: 'profile.delete.reasonSwitching' },
  { value: 'privacy', labelKey: 'profile.delete.reasonPrivacy' },
  { value: 'other', labelKey: 'profile.delete.reasonOther' },
];

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const confirmWord = t('profile.delete.confirmWord');
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
      if (!session?.access_token) throw new Error(t('profile.delete.sessionExpired'));

      // Apple 로그인 계정(iOS 네이티브)은 탈퇴 직전 재인증으로 일회성 코드를 받아
      // 서버가 Apple 토큰을 revoke 하도록 넘긴다 (5.1.1). 실패해도 탈퇴는 진행.
      let appleAuthCode: string | undefined;
      try {
        const { isNativeApp, platformAuth } = await import('@/lib/platform');
        if (isNativeApp() && session.user?.app_metadata?.provider === 'apple') {
          appleAuthCode = await platformAuth.getAppleRevokeCode();
        }
      } catch {}

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || null,
          reasonDetail: reasonDetail.trim() || null,
          appleAuthCode: appleAuthCode || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t('profile.delete.deleteFailed'));

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
      setErrorMsg(err instanceof Error ? err.message : t('profile.delete.error'));
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
          <h3 className="text-sm font-bold text-gray-800 mb-1">{t('profile.delete.title')}</h3>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            {t.rich('profile.delete.warning', { b: (c) => <span className="text-red-400 font-medium">{c}</span>, br: () => <br /> })}
          </p>
        </div>

        <div className="mb-3">
          <p className="text-[11px] text-gray-500 mb-1.5">{t('profile.delete.reasonLabel')} <span className="text-gray-300">{t('profile.delete.reasonOptional')}</span></p>
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
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          {reason === 'other' && (
            <TextField
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value.slice(0, 100))}
              placeholder={t('profile.delete.detailPlaceholder')}
              className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none"
            />
          )}
        </div>

        <div className="mb-4">
          <p className="text-[11px] text-gray-400 mb-1.5">{t.rich('profile.delete.confirmPrompt', { word: confirmWord, b: (c) => <span className="font-bold text-gray-600">{c}</span> })}</p>
          <TextField
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>

        {errorMsg && <p className="text-red-500 text-xs mb-3">{errorMsg}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== confirmWord}
            className="flex-1 h-10 bg-red-500 text-[#fff] rounded-full text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {deleting ? t('profile.delete.deleting') : t('profile.delete.deleteCta')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Profile Page ─────────────────────────────────────
export default function ProfilePage() {
  const t = useTranslations();
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
    // Capacitor 네이티브 앱은 standalone 으로 안 잡히므로 isNativeApp() 도 "설치된 앱"으로 인정.
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches || isNativeApp());
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
    // 언어 쿠키 초기화 — 언어는 계정 종속. 안 지우면 다음 로그인 계정에 이전 언어 누수.
    // (다음 로그인 시 그 계정의 preferred_language, 없으면 기본 ko 가 적용됨)
    try { document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`; } catch {}
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
                alt={t('profile.avatarAlt')}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"

              />
            ) : (
              <User size={28} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">
              {profile?.nickname || t('profile.fallbackName')}
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
            <span className="text-sm">{t('profile.menu.pets')}</span>
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
            <span className="text-sm">{t('profile.menu.saved')}</span>
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
            <span className="text-sm">{t('profile.menu.notifications')}</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Settings size={18} className="text-gray-400" />
            <span className="text-sm">{t('profile.menu.appSettings')}</span>
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
            <span className="text-sm">{t('subscription.title')}</span>
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
            <span className="text-sm">{t('profile.menu.policies')}</span>
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
            <span className="text-sm">{t('profile.menu.logout')}</span>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full px-4 py-3.5 flex items-center rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-300">
            <UserX size={18} />
            <span className="text-sm">{t('profile.menu.deleteAccount')}</span>
          </div>
        </button>
      </div>

      <div className="py-8 px-6 text-center">
        <div className="text-[10px] text-gray-300 leading-relaxed">
          <p>{t('profile.business.line1')}</p>
          <p>{t('profile.business.regNo')}</p>
          <p>{t('profile.business.ecommerceNo')}</p>
          <p>{t('profile.business.address')}</p>
          <p>{t('profile.business.contact')}</p>
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
          message = t('profile.alarm.needAppPlus');
          buttonLabel = t('subscription.title');
          buttonAction = () => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); };
        } else if (needApp && !needPlus) {
          message = t('profile.alarm.needApp');
          buttonLabel = t('common.confirm');
        } else if (!needApp && needPlus) {
          message = t('profile.alarm.needPlus');
          buttonLabel = t('subscription.title');
          buttonAction = () => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); };
        }

        return (
          <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">{t('profile.alarm.title')}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1 break-keep break-words">{message}</p>
              <p className="text-xs text-gray-400 mb-4 break-keep break-words">{t('profile.alarm.subDesc')}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAlarmUpgrade(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  {t('common.close')}
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
