'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pill, Bell, BellOff, Loader2, Trash2, X } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, Medication, MedicationKind } from '@/lib/supabase';
import { getEffectivePlan } from '@/lib/plans';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { ColorPicker } from '@/components/records/ColorPicker';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { todayLocalISO } from '@/lib/date';

const frequencyOptions = [
  { value: '1일 1회', times: 1 },
  { value: '1일 2회', times: 2 },
  { value: '1일 3회', times: 3 },
];

const defaultAlarmTimes: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '21:00'],
};

const kindOptions: { value: MedicationKind; label: string; badge: string; chipActive: string }[] = [
  { value: 'prescription', label: '처방약', badge: 'bg-blue-50 text-blue-600',     chipActive: 'bg-blue-600 text-white' },
  { value: 'supplement',   label: '영양제', badge: 'bg-green-50 text-green-600',   chipActive: 'bg-green-600 text-white' },
  { value: 'other',        label: '기타',   badge: 'bg-gray-100 text-gray-500',    chipActive: 'bg-gray-600 text-white' },
];

const kindMeta = (k?: MedicationKind) => kindOptions.find((o) => o.value === (k || 'prescription')) || kindOptions[0];

interface MedForm {
  id?: string;
  name: string;
  dosage: string;
  kind: MedicationKind;
  start_date: string;
  end_date: string;
  frequency: string;
  color: string;
  alarm_enabled: boolean;
  alarm_times: string[];
}

const emptyForm = (): MedForm => ({
  name: '', dosage: '', kind: 'prescription',
  start_date: todayLocalISO(), end_date: '',
  frequency: '1일 1회', color: '#EC4899',
  alarm_enabled: false, alarm_times: ['09:00'],
});

function fromMed(m: Medication): MedForm {
  return {
    id: m.id,
    name: m.name,
    dosage: m.dosage || '',
    kind: m.kind || 'prescription',
    start_date: m.start_date,
    end_date: m.end_date || '',
    frequency: m.frequency || '1일 1회',
    color: m.color || '#EC4899',
    alarm_enabled: !!m.alarm_enabled,
    alarm_times: (m.alarm_times && m.alarm_times.length > 0) ? m.alarm_times : ['09:00'],
  };
}

export default function MedsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { getMedicationsByPet, addMedication, updateMedication, deleteMedication } = useMedications();

  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  // 편집기(추가/수정) 상태
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<MedForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 알림 관련
  const [isPWA, setIsPWA] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);

  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
  }, []);

  // 펫 로딩 + 기본 펫 자동 선택 (건강 통계와 동일 패턴 — '전체' 없이 항상 한 마리 선택)
  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const defaultId = readDefaultPetId();
          const sorted = sortPetsWithDefault(data, defaultId);
          setPets(sorted);
          if (sorted.length >= 1) {
            const def = defaultId && sorted.some((p) => p.id === defaultId) ? defaultId : sorted[0].id;
            setSelectedPetId(def);
          }
        }
        setPetsLoaded(true);
      });
  }, [user]);

  const load = useCallback(async () => {
    if (!selectedPetId) { setMeds([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getMedicationsByPet(selectedPetId);
      setMeds(data as Medication[]);
    } finally {
      setLoading(false);
    }
  }, [selectedPetId, getMedicationsByPet]);

  useEffect(() => { load(); }, [load]);

  // 복용중 / 종료 분류
  const today = todayLocalISO();
  const active = meds.filter((m) => !m.end_date || m.end_date >= today);
  const ended = meds.filter((m) => m.end_date && m.end_date < today);

  const openAdd = () => { setForm(emptyForm()); setFormError(null); setEditorOpen(true); };
  const openEdit = (m: Medication) => { setForm(fromMed(m)); setFormError(null); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setSubscribing(false); };

  const setFreq = (freq: string) => {
    const opt = frequencyOptions.find((f) => f.value === freq);
    const times = opt ? defaultAlarmTimes[opt.times] : ['09:00'];
    setForm((f) => ({ ...f, frequency: freq, alarm_times: times }));
  };

  const setAlarmTime = (idx: number, value: string) => {
    setForm((f) => {
      const next = [...f.alarm_times];
      next[idx] = value;
      return { ...f, alarm_times: next };
    });
  };

  const toggleAlarm = async () => {
    const turningOn = !form.alarm_enabled;
    if (turningOn && !canUseAlarm) { setShowAlarmUpgrade(true); return; }

    let shouldSubscribe = false;
    if (turningOn && canUseAlarm) {
      const browserGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
      let hasExistingSub = false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        hasExistingSub = !!(await reg?.pushManager.getSubscription());
      } catch {}
      if (browserGranted || hasExistingSub) shouldSubscribe = true;
      else if (notifPermission === 'default') { setShowPushPrompt(true); return; }
    }

    setForm((f) => ({ ...f, alarm_enabled: turningOn }));

    if (shouldSubscribe && user) {
      setSubscribing(true);
      try {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'meds-toggle-subscribe' },
          });
        } else if (notifPermission !== 'granted' && typeof Notification !== 'undefined') {
          setNotifPermission(Notification.permission);
        }
      } finally {
        setSubscribing(false);
      }
    }
  };

  const handlePushAllow = async () => {
    setShowPushPrompt(false);
    if (typeof Notification === 'undefined' || !user) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      setForm((f) => ({ ...f, alarm_enabled: true }));
      if (permission === 'granted') {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'meds-soft-prompt-subscribe' },
          });
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'push', action: 'meds-soft-prompt' } });
    } finally {
      setSubscribing(false);
    }
  };

  const saveMed = async () => {
    if (!selectedPetId) { setFormError('반려동물을 먼저 선택해주세요.'); return; }
    if (!form.name.trim()) { setFormError('약 이름을 입력해주세요.'); return; }
    if (form.end_date && form.end_date < form.start_date) { setFormError('종료일이 시작일보다 빠를 수 없어요.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const alarmTimes = form.alarm_enabled ? form.alarm_times : [];
      if (form.id) {
        await updateMedication(form.id, {
          name: form.name.trim(),
          dosage: form.dosage.trim() || undefined,
          kind: form.kind,
          start_date: form.start_date,
          end_date: form.end_date || null,
          frequency: form.frequency,
          color: form.color,
          alarm_enabled: form.alarm_enabled,
          alarm_times: alarmTimes,
        });
      } else {
        await addMedication({
          pet_id: selectedPetId,
          kind: form.kind,
          name: form.name.trim(),
          dosage: form.dosage.trim() || undefined,
          start_date: form.start_date,
          end_date: form.end_date || undefined,
          frequency: form.frequency,
          color: form.color,
          alarm_enabled: form.alarm_enabled,
          alarm_times: alarmTimes,
        });
      }
      // 알림 ON + 권한 허용 상태면 구독 백업 (멱등)
      if (form.alarm_enabled && canUseAlarm && user && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await ensurePushSubscribed(user.id).catch(() => {});
      }
      closeEditor();
      await load();
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'medications', action: form.id ? 'edit' : 'add' }, extra: { userId: user?.id } });
      setFormError('저장 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    if (!id) return;
    try {
      await deleteMedication(id);
      await load();
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'medications', action: 'delete' }, extra: { userId: user?.id } });
    }
  };

  const fmtDate = (d?: string | null) => (d ? `${parseInt(d.split('-')[1])}.${parseInt(d.split('-')[2])}` : '');

  const MedCard = ({ m, dim }: { m: Medication; dim?: boolean }) => {
    const km = kindMeta(m.kind);
    return (
      <button
        onClick={() => openEdit(m)}
        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white transition-colors hover:bg-gray-50 ${dim ? 'opacity-60' : ''}`}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color || '#EC4899' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate">{m.name}</span>
            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${km.badge}`}>{km.label}</span>
            {m.alarm_enabled && <Bell size={12} className="flex-shrink-0 text-blue-500" />}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {m.dosage && `${m.dosage} · `}{m.frequency}
            {m.start_date && ` · ${fmtDate(m.start_date)}${m.end_date ? `~${fmtDate(m.end_date)}` : '~'}`}
          </p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(m.id); }}
          className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
          aria-label="삭제"
        >
          <Trash2 size={15} />
        </span>
      </button>
    );
  };

  if (authLoading) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] animate-pulse p-4 max-w-sm mx-auto">
        <div className="h-10 bg-gray-100 rounded-full mb-4 mt-4" />
        <div className="space-y-3"><div className="h-16 bg-gray-50 rounded-xl" /><div className="h-16 bg-gray-50 rounded-xl" /></div>
      </div>
    );
  }
  if (!user) return null;

  const noPets = petsLoaded && pets.length === 0;

  return (
    <div className="bg-white min-h-full pb-24 relative">
      {/* 헤더 — 건강 통계와 동일: 중앙 정렬 타이틀 + 좌측 뒤로가기 + 펫 칩 */}
      <div className="sticky top-0 z-30 bg-white relative">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">복약 관리</h1>
        </header>
        {pets.length > 1 && (
          <div className={`flex gap-1.5 overflow-x-auto max-w-sm mx-auto px-4 pt-1 pb-2 ${pets.length <= 4 ? 'justify-center' : ''}`}>
            {pets.map((pet) => (
              <button key={pet.id} onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === pet.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {pet.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-sm mx-auto px-4 pt-2 pb-4 space-y-5">
        {noPets ? (
          <div className="text-center py-16">
            <Pill size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">먼저 반려동물을 등록해주세요.</p>
          </div>
        ) : (!petsLoaded || loading) ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 leading-snug">
              진료·입퇴원 기록에 적은 약도 자동으로 여기에 모여요. 복용 체크는 캘린더에서 할 수 있어요.
            </p>

            {meds.length === 0 ? (
              <div className="text-center py-12">
                <Pill size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">등록된 약·영양제가 없어요.</p>
                <p className="text-gray-300 text-xs mt-1">+ 버튼으로 추가해보세요</p>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-[13px] font-bold text-gray-700">복용 중 {active.length}</h2>
                    {active.map((m) => <MedCard key={m.id} m={m} />)}
                  </div>
                )}
                {ended.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-[13px] font-bold text-gray-400">종료 {ended.length}</h2>
                    {ended.map((m) => <MedCard key={m.id} m={m} dim />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 추가 버튼 */}
      {!noPets && selectedPetId && !editorOpen && (
        <button
          onClick={openAdd}
          className="fixed bottom-20 w-13 h-13 bg-blue-600 text-[#fff] rounded-full shadow-md flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
          style={{ right: 'max(1rem, calc(50% - 224px + 1rem))' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* 편집기 (바텀시트) */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={closeEditor}>
          <div
            className="w-full max-w-sm bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{form.id ? '약 수정' : '약 추가'}</h2>
              <button onClick={closeEditor} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="p-4 space-y-3">
              {/* 종류 */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">종류</label>
                <div className="flex gap-1.5">
                  {kindOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kind: opt.value }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        form.kind === opt.value ? opt.chipActive : 'bg-white border border-gray-200 text-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="search"
                placeholder="약·영양제 이름"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={20}
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
              />
              <input
                type="search"
                placeholder="용량 (예: 1정)"
                value={form.dosage}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                maxLength={20}
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
              />

              <div>
                <label className="text-xs text-gray-400 mb-1 block">투약 빈도</label>
                <div className="flex gap-1.5">
                  {frequencyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFreq(opt.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.frequency === opt.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
                      }`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">시작일</label>
                  <DatePicker
                    value={form.start_date}
                    onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
                    inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">종료일 (선택)</label>
                  <DatePicker
                    value={form.end_date}
                    onChange={(v) => setForm((f) => ({ ...f, end_date: v }))}
                    min={form.start_date}
                    inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              <ColorPicker label="캘린더 색상" value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />

              {/* 투약 알림 */}
              <div className="border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => (canUseAlarm ? toggleAlarm() : setShowAlarmUpgrade(true))}
                  disabled={subscribing}
                  className={`flex items-center gap-2 w-full py-2 px-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                    form.alarm_enabled ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {subscribing ? <Loader2 size={14} className="animate-spin" /> : form.alarm_enabled ? <Bell size={14} /> : <BellOff size={14} />}
                  {subscribing ? '알림 켜는 중...' : `투약 알림 ${form.alarm_enabled ? 'ON' : 'OFF'}`}
                </button>
                {canUseAlarm && form.alarm_enabled && notifPermission === 'denied' && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 mt-1 bg-red-50 border border-red-100 rounded-md text-[11px] text-red-600 leading-snug">
                    <BellOff size={11} className="flex-shrink-0 mt-0.5" />
                    <p>브라우저 알림이 차단되어 있어요! 앱 설정에서 알림 허용으로 변경 후 다시 시도해주세요</p>
                  </div>
                )}
                {canUseAlarm && form.alarm_enabled && (
                  <div className="space-y-1.5 mt-1">
                    {form.alarm_times.map((time, ti) => (
                      <div key={ti} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-12">{ti + 1}회차</span>
                        <TimePicker value={time} onChange={(v) => setAlarmTime(ti, v)} minuteStep={15} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}

              <button
                onClick={saveMed}
                disabled={saving || !form.name.trim()}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : form.id ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 권한 soft-prompt */}
      <ConfirmModal
        open={showPushPrompt}
        title="투약 알림을 받을까요?"
        message="설정한 시간에 투약 알림을 보내드려요. 알림을 허용하면 바로 적용됩니다."
        confirmLabel="받을게요"
        cancelLabel="나중에"
        onConfirm={handlePushAllow}
        onCancel={() => setShowPushPrompt(false)}
      />

      {/* Plus 전용 안내 */}
      <ConfirmModal
        open={showAlarmUpgrade}
        title="투약 알림은 Plus 전용이에요"
        message="앱(홈 화면에 추가)에서 Plus 플랜으로 투약 알림을 받을 수 있어요."
        confirmLabel="플랜 보기"
        cancelLabel="닫기"
        onConfirm={() => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); }}
        onCancel={() => setShowAlarmUpgrade(false)}
      />

      {/* 삭제 확인 */}
      <ConfirmModal
        open={!!deleteTarget}
        title="이 약을 삭제할까요?"
        message="삭제하면 복용 기록·알림도 함께 사라져요."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
