'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Plus, Syringe, Bell, BellOff, Loader2, Trash2, X, AlertTriangle, Check } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { usePreventiveCares } from '@/hooks/usePreventiveCares';
import { supabase, Pet, PreventiveCare, PreventiveCategory } from '@/lib/supabase';
import { getEffectivePlan } from '@/lib/plans';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { isInstalledApp, isNativeApp } from '@/lib/platform';
import {
  PREVENTIVE_CATEGORIES, categoryMeta, categoryLabel, categoryProducts, intervalLabel,
  addInterval, careStatus, ddayLabel, todayISO, type CareStatus,
} from '@/lib/preventiveCare';

// 주기 프리셋 — 라벨은 intervalLabel(unit,value,t)로 렌더 (월1/3개월/6개월/연1).
const INTERVAL_PRESETS: { unit: 'month' | 'year'; value: number }[] = [
  { unit: 'month', value: 1 },
  { unit: 'month', value: 3 },
  { unit: 'month', value: 6 },
  { unit: 'year',  value: 1 },
];

interface CareForm {
  id?: string;
  category: PreventiveCategory;
  name: string;
  last_done_date: string;
  interval_unit: 'month' | 'year';
  interval_value: number;
  alarm_enabled: boolean;
}

const emptyForm = (): CareForm => ({
  category: 'heartworm',
  name: '',
  last_done_date: todayISO(),
  interval_unit: 'month',
  interval_value: 1,
  alarm_enabled: false, // 복약과 동일하게 기본 OFF (사용자가 직접 켬)
});

function fromCare(c: PreventiveCare): CareForm {
  return {
    id: c.id,
    category: c.category,
    name: c.name || '',
    last_done_date: c.last_done_date,
    interval_unit: c.interval_unit,
    interval_value: c.interval_value,
    alarm_enabled: !!c.alarm_enabled,
  };
}

// 상태별 배지 색
const ddayBadge: Record<CareStatus, string> = {
  overdue: 'bg-red-100 text-red-600',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-gray-100 text-gray-400',
};
// label 은 preventive.status.* messages 로 분리 — status id 로 참조.
const groupMeta: Record<CareStatus, { dot: string; text: string }> = {
  overdue: { dot: 'bg-red-500', text: 'text-red-600' },
  soon: { dot: 'bg-amber-500', text: 'text-amber-600' },
  ok: { dot: 'bg-gray-300', text: 'text-gray-400' },
};

export default function PreventivePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { getByPet, addCare, updateCare, markDone, deleteCare } = usePreventiveCares();

  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoaded, setPetsLoaded] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);
  const [cares, setCares] = useState<PreventiveCare[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<CareForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [doneTarget, setDoneTarget] = useState<PreventiveCare | null>(null);
  const [doneDate, setDoneDate] = useState<string>(todayISO());
  const [deleteTarget, setDeleteTarget] = useState<PreventiveCare | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 알림 (복약과 동일 정책 — PWA + Plus)
  const [isPWA, setIsPWA] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);

  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsPWA(isInstalledApp());
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission);
  }, []);

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
    if (!selectedPetId) { setCares([]); setLoading(false); return; }
    setLoading(true);
    try {
      setCares(await getByPet(selectedPetId));
    } finally {
      setLoading(false);
    }
  }, [selectedPetId, getByPet]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm()); setFormError(null); setEditorOpen(true); };
  const openEdit = (c: PreventiveCare) => { setForm(fromCare(c)); setFormError(null); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setSubscribing(false); };

  // 카테고리 선택 → 기본 주기 자동 채움 (제품명은 유지)
  const pickCategory = (cat: PreventiveCategory) => {
    const meta = categoryMeta(cat);
    setForm((f) => ({ ...f, category: cat, interval_unit: meta.defaultUnit, interval_value: meta.defaultValue }));
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
      if (isNativeApp() || browserGranted || hasExistingSub) shouldSubscribe = true;
      else if (notifPermission === 'default') { setShowPushPrompt(true); return; }
    }

    setForm((f) => ({ ...f, alarm_enabled: turningOn }));

    if (shouldSubscribe && user) {
      setSubscribing(true);
      try {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'preventive-toggle-subscribe' },
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
            tags: { feature: 'push', action: 'preventive-soft-prompt-subscribe' },
          });
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'push', action: 'preventive-soft-prompt' } });
    } finally {
      setSubscribing(false);
    }
  };

  const saveCare = async () => {
    if (!selectedPetId) { setFormError(t('preventive.selectPet')); return; }
    setFormError(null);
    setSaving(true);
    try {
      const name = form.name.trim() || categoryMeta(form.category).label; // 제품명 없으면 카테고리명
      if (form.id) {
        await updateCare(form.id, {
          category: form.category,
          name,
          last_done_date: form.last_done_date,
          interval_unit: form.interval_unit,
          interval_value: form.interval_value,
          alarm_enabled: form.alarm_enabled,
        });
      } else {
        await addCare({
          pet_id: selectedPetId,
          category: form.category,
          name,
          last_done_date: form.last_done_date,
          interval_unit: form.interval_unit,
          interval_value: form.interval_value,
          alarm_enabled: form.alarm_enabled,
        });
      }
      if (form.alarm_enabled && canUseAlarm && user && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await ensurePushSubscribed(user.id).catch(() => {});
      }
      closeEditor();
      await load();
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'preventive', action: form.id ? 'edit' : 'add' }, extra: { userId: user?.id } });
      setFormError(t('preventive.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDone = async () => {
    const tgt = doneTarget;
    setDoneTarget(null);
    if (!tgt) return;
    const nextDue = addInterval(doneDate, tgt.interval_unit, tgt.interval_value);
    try {
      await markDone(tgt.id, doneDate, tgt.interval_unit, tgt.interval_value);
      await load();
      // 무엇이 일어났는지 즉시 보여주는 피드백 (방금 등록 직후 "안 변하는데?" 혼란 방지)
      setToast(t('preventive.toastUpdated', { date: nextDue.replace(/-/g, '. ') }));
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'preventive', action: 'done' }, extra: { userId: user?.id } });
    }
  };

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const confirmDelete = async () => {
    const t = deleteTarget;
    setDeleteTarget(null);
    if (!t) return;
    try {
      await deleteCare(t.id);
      await load();
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'preventive', action: 'delete' }, extra: { userId: user?.id } });
    }
  };

  // 영어는 "Jun 16", 한국어는 "6.16".
  const fmtDate = (d?: string | null) => {
    if (!d) return '';
    if (locale === 'en') return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${parseInt(d.split('-')[1])}.${parseInt(d.split('-')[2])}`;
  };

  // 상태별 그룹 (이미 next_due 오름차순 정렬됨)
  const grouped: Record<CareStatus, PreventiveCare[]> = { overdue: [], soon: [], ok: [] };
  for (const c of cares) grouped[careStatus(c.next_due_date)].push(c);

  const CareCard = ({ c }: { c: PreventiveCare }) => {
    const meta = categoryMeta(c.category);
    const st = careStatus(c.next_due_date);
    return (
      <div className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-white ${
        st === 'overdue' ? 'border-red-100' : st === 'soon' ? 'border-amber-100' : 'border-gray-100'
      }`}>
        <button onClick={() => openEdit(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 text-lg">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 truncate">{categoryLabel(c.category, t)}</span>
              {c.name && c.name !== meta.label && <span className="text-[11px] text-gray-400 truncate">{c.name}</span>}
              {c.alarm_enabled && <Bell size={11} className="flex-shrink-0 text-blue-500" />}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {t('preventive.nextPrefix')} {fmtDate(c.next_due_date)} · {intervalLabel(c.interval_unit, c.interval_value, t)}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ddayBadge[st]}`}>{ddayLabel(c.next_due_date, t)}</span>
          <button
            onClick={() => { setDoneDate(todayISO()); setDoneTarget(c); }}
            className="text-[11px] font-bold text-blue-600 border border-blue-100 bg-white rounded-full px-2.5 py-1 hover:bg-blue-50 transition-colors"
          >
            {t('preventive.done')}
          </button>
        </div>
      </div>
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
  const nextDuePreview = addInterval(form.last_done_date, form.interval_unit, form.interval_value);

  return (
    <div className="bg-white min-h-full pb-24 relative">
      {/* 헤더 — 복약 관리와 동일 */}
      <div className="sticky top-0 z-30 bg-white relative">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label={t('common.back')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">{t('record.module.preventive')}</h1>
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
            <Syringe size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">{t('common.registerPetFirst')}</p>
          </div>
        ) : (!petsLoaded || loading) ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 leading-snug">
              {t('preventive.intro')}
            </p>

            {cares.length === 0 ? (
              <div className="text-center py-12">
                <Syringe size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">{t('preventive.empty')}</p>
                <p className="text-gray-300 text-xs mt-1">{t('preventive.emptyHint')}</p>
              </div>
            ) : (
              (['overdue', 'soon', 'ok'] as CareStatus[]).map((st) =>
                grouped[st].length > 0 ? (
                  <div key={st} className="space-y-2">
                    <h2 className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wide ${groupMeta[st].text}`}>
                      <span className={`w-2 h-2 rounded-full ${groupMeta[st].dot}`} />{t(`preventive.status.${st}`)}
                    </h2>
                    {grouped[st].map((c) => <CareCard key={c.id} c={c} />)}
                  </div>
                ) : null
              )
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeEditor}>
          <div className="w-full max-w-sm bg-white rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{form.id ? t('preventive.editTitle') : t('preventive.addTitle')}</h2>
              <button onClick={closeEditor} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="p-4 space-y-3">
              {/* 카테고리 */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">{t('preventive.categoryLabel')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {PREVENTIVE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => pickCategory(cat.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.category === cat.id ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-500'
                      }`}
                    >
                      {cat.emoji} {categoryLabel(cat.id, t)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제품 (선택) */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">{t('preventive.product')} <span className="text-gray-300">{t('common.optional')}</span></label>
                {categoryProducts(form.category, locale).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {categoryProducts(form.category, locale).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, name: f.name === p ? '' : p }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          form.name === p ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="search"
                  placeholder={t('preventive.productPlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  maxLength={24}
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
              </div>

              {/* 주기 */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">{t('preventive.cycleLabel')}</label>
                <div className="flex gap-1.5">
                  {INTERVAL_PRESETS.map((p) => {
                    const on = form.interval_unit === p.unit && form.interval_value === p.value;
                    return (
                      <button
                        key={`${p.unit}-${p.value}`}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, interval_unit: p.unit, interval_value: p.value }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          on ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-500'
                        }`}
                      >
                        {intervalLabel(p.unit, p.value, t)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 마지막 시행일 */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t('preventive.lastDone')}</label>
                <DatePicker
                  value={form.last_done_date}
                  onChange={(v) => setForm((f) => ({ ...f, last_done_date: v }))}
                  max={todayISO()}
                  inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                />
                <p className="text-[11px] text-blue-500 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1.5">
                  {t.rich('preventive.nextDueCalc', { date: nextDuePreview.replace(/-/g, '. '), b: (c) => <b>{c}</b> })}
                </p>
              </div>

              {/* 예방 알림 */}
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
                  {subscribing ? t('record.form.alarmTurningOn') : t('preventive.alarm', { state: form.alarm_enabled ? 'ON' : 'OFF' })}
                </button>
                {canUseAlarm && form.alarm_enabled && (
                  <p className="text-[11px] text-gray-400 px-1">{t('preventive.alarmHint')}</p>
                )}
                {canUseAlarm && form.alarm_enabled && notifPermission === 'denied' && !isNativeApp() && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 mt-1 bg-red-50 border border-red-100 rounded-md text-[11px] text-red-600 leading-snug">
                    <BellOff size={11} className="flex-shrink-0 mt-0.5" />
                    <p>{t('record.form.notifBlocked')}</p>
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}

              <button
                onClick={saveCare}
                disabled={saving}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {saving ? t('record.form.saving') : form.id ? t('common.edit') : t('common.add')}
              </button>

              {form.id && (
                <button
                  onClick={() => {
                    const c = cares.find((x) => x.id === form.id);
                    if (c) { closeEditor(); setDeleteTarget(c); }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} /> {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 알림 권한 soft-prompt */}
      <ConfirmModal
        open={showPushPrompt}
        title={t('preventive.softPromptTitle')}
        message={t('preventive.softPromptMsg')}
        confirmLabel={t('record.form.allow')}
        cancelLabel={t('record.form.later')}
        onConfirm={handlePushAllow}
        onCancel={() => setShowPushPrompt(false)}
      />

      {/* 완료 확인 */}
      {doneTarget && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setDoneTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDoneTarget(null)} className="absolute top-3 right-3 p-0.5 text-gray-300 hover:text-gray-500" aria-label={t('common.close')}><X size={16} /></button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-blue-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">{t('preventive.doneTitle', { name: categoryLabel(doneTarget.category, t) })}</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3 break-keep break-words">
              {t.rich('preventive.doneDesc', { interval: intervalLabel(doneTarget.interval_unit, doneTarget.interval_value, t), b: (c) => <b>{c}</b> })}
            </p>
            <label className="text-xs text-gray-400 mb-1 block">{t('preventive.doneDate')}</label>
            <DatePicker value={doneDate} onChange={setDoneDate} max={todayISO()}
              inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white mb-2" />
            <p className="text-[11px] text-blue-500 bg-blue-50 rounded-lg px-2.5 py-1.5 mb-4">
              {t.rich('preventive.nextDueShort', { date: addInterval(doneDate, doneTarget.interval_unit, doneTarget.interval_value).replace(/-/g, '. '), b: (c) => <b>{c}</b> })}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDoneTarget(null)} className="flex-1 py-2.5 rounded-full text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">{t('common.cancel')}</button>
              <button onClick={confirmDone} className="flex-1 py-2.5 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">{t('preventive.done')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget ? t('preventive.deleteTitle', { name: categoryLabel(deleteTarget.category, t) }) : ''}
        message={t('preventive.deleteMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 알림 업그레이드 안내 — 복약과 동일 디자인, 예방 포함 문구 */}
      {showAlarmUpgrade && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-gray-800">{t('record.form.alarmFeatureTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1 break-keep break-words">
              {!isPWA ? t('record.form.alarmUpsellApp') : t('record.form.alarmUpsellWeb')}
            </p>
            <p className="text-xs text-gray-400 mb-4 break-keep break-words">{t('record.form.alarmUpsellDesc')}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowAlarmUpgrade(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">{t('common.close')}</button>
              <button onClick={() => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">{t('record.form.viewPlans')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 완료 피드백 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-full bg-gray-900/90 text-white text-xs font-medium shadow-lg flex items-center gap-1.5 max-w-[90vw]">
          <Check size={13} className="text-green-400 flex-shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}
