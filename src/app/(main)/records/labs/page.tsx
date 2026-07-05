'use client';

// 검사 기록 — Plus 전용. Free 는 잠금 랜딩(전환 유도), Plus 는 검사 목록 + 추가.
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Plus, FlaskConical, Lock, ChevronRight, FileText, Paperclip } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectivePlan } from '@/lib/plans';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { trackEvent, trackPageViewDaily } from '@/lib/trackEvent';
import { useLabTests, LabTest } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, templateLabel } from '@/lib/labCatalog';

type TFn = (key: string, values?: Record<string, string | number>) => string;
// 카테고리 많으면 잘리니 '첫 외 N개'로 요약(2개 이하는 그대로).
const catSummary = (cats: string[] | null | undefined, locale: string, t: TFn) => {
  const labels = (cats || []).map((k) => { const tpl = LAB_TEMPLATES.find((x) => x.key === k); return tpl ? templateLabel(tpl, locale) : k; });
  if (labels.length === 0) return t('lab.list.fallbackTitle');
  if (labels.length <= 2) return labels.join(' · ');
  return t('lab.list.catMore', { first: labels[0], n: labels.length - 1 });
};

// 세션 중 마지막 선택 펫(메모리) — 다른 페이지 갔다 와도 유지. 기록장 sessionSelectedPetId 와 동일 패턴.
let sessionLabPetId: string | undefined = undefined;

export default function LabsPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { user, profile, loading: authLoading } = useAuth();
  const isPlus = getEffectivePlan(profile?.plan) === 'plus';
  const { getLabTests } = useLabTests();

  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | undefined>(undefined);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoaded, setPetsLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        const sorted = sortPetsWithDefault(data, readDefaultPetId());
        setPets(sorted);
        // 우선순위: URL ?pet= > 세션 마지막선택 > 기본펫(정렬 첫). 저장 후 그 펫이 선택되도록.
        const petParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pet') || undefined : undefined;
        const valid = (id?: string) => !!id && sorted.some((p) => p.id === id);
        const initial = valid(petParam) ? petParam : valid(sessionLabPetId) ? sessionLabPetId : sorted[0]?.id;
        if (initial) { setSelectedPetId(initial); sessionLabPetId = initial; }
      }
      setPetsLoaded(true);
    });
  }, [user]);

  const load = useCallback(async () => {
    // 펫 로딩 전엔 loading 유지 → 빈 상태가 잠깐 깜빡이는 것 방지.
    if (!isPlus || !selectedPetId) return;
    setLoading(true);
    try {
      setTests(await getLabTests(selectedPetId));
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'labs', action: 'page-load' } });
    } finally {
      setLoading(false);
    }
  }, [isPlus, selectedPetId, getLabTests]);

  useEffect(() => { load(); }, [load]);

  // 추가/수정 후 back() 으로 돌아오면 목록이 stale → popstate 때 갱신.
  useEffect(() => {
    const onPop = () => {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lab_list_reload') === '1') {
        sessionStorage.removeItem('lab_list_reload');
        load();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  // 이벤트 로그: Free 가 잠금 화면을 봄(하루 1회) / Plus 진입.
  useEffect(() => {
    if (authLoading) return;
    if (!isPlus) trackPageViewDaily('lab_lock_view');
    else trackEvent('lab_create_start');
  }, [authLoading, isPlus]);

  if (authLoading) return <div className="bg-white min-h-full" />;

  return (
    <div className="bg-white min-h-full pb-24">
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label={t('common.back')}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-sm font-semibold text-gray-700">{t('lab.title')}</h1>
        </header>
      </div>

      {!isPlus ? (
        <LockLanding onUpgrade={() => { trackEvent('lab_upgrade_click'); router.push('/profile/subscription'); }} />
      ) : (
        <div className="max-w-sm mx-auto px-4 pt-1">
          {/* 펫 선택 — 헤더~펫이름 간격을 건강통계 등 표준(pt-1 pb-2)과 동일하게 */}
          {pets.length > 1 && (
            <div className={`flex gap-1.5 overflow-x-auto pb-2 ${pets.length <= 4 ? 'justify-center' : ''}`}>
              {pets.map((p) => (
                <button key={p.id} onClick={() => { setSelectedPetId(p.id); sessionLabPetId = p.id; }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPetId === p.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {!petsLoaded || (selectedPetId && loading) ? (
            <div className="space-y-2 pt-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : !selectedPetId ? (
            <div className="text-center py-16">
              <FlaskConical size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">{t('lab.list.emptyNoPet')}</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-16">
              <FlaskConical size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">{t('lab.list.emptyNoTest')}</p>
              <p className="text-gray-300 text-xs mt-1">{t('lab.list.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {tests.map((test) => (
                <button key={test.id} onClick={() => router.push(`/records/labs/${test.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left">
                  <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <FlaskConical size={18} className="text-indigo-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      {catSummary(test.categories, locale, t)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                      <span className="truncate">{test.test_date}{test.hospital_name ? ` · ${test.hospital_name}` : ''} · {t('lab.list.valueCount', { count: test.lab_values?.length ?? 0 })}</span>
                      {(test.lab_test_files?.length ?? 0) > 0 && <Paperclip size={11} className="text-gray-300 flex-shrink-0" />}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isPlus && selectedPetId && (
        <button
          onClick={() => router.push(`/records/labs/add?pet=${selectedPetId}`)}
          className="fixed w-13 h-13 bg-blue-600 text-[#fff] rounded-full shadow-md flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
          style={{ right: 'max(1rem, calc(50% - 224px + 1rem))', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          aria-label={t('lab.list.addAria')}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

function LockLanding({ onUpgrade }: { onUpgrade: () => void }) {
  const t = useTranslations();
  return (
    <div className="max-w-sm mx-auto px-5 pt-8 pb-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
        <FlaskConical size={30} className="text-indigo-500" />
      </div>
      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full mb-3">
        <Lock size={10} /> {t('lab.lock.badge')}
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">{t('lab.lock.title')}</h2>
      <p className="text-[13px] text-gray-500 leading-relaxed mb-6 whitespace-pre-line">
        {t('lab.lock.subtitle')}
      </p>

      <div className="text-left space-y-2.5 mb-7">
        {[t('lab.lock.f1'), t('lab.lock.f2'), t('lab.lock.f3'), t('lab.lock.f4')].map((f) => (
          <div key={f} className="flex items-start gap-2">
            <FileText size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <span className="text-[13px] text-gray-600">{f}</span>
          </div>
        ))}
      </div>

      <button onClick={onUpgrade}
        className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors">
        {t('lab.lock.cta')}
      </button>
      <p className="text-[11px] text-gray-300 mt-3 leading-relaxed whitespace-pre-line">
        {t('lab.lock.footer')}
      </p>
    </div>
  );
}
