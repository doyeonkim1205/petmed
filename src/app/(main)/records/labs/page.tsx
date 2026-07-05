'use client';

// 검사 수치 v1 — Plus 전용. Free 는 잠금 랜딩(전환 유도), Plus 는 검사 목록 + 추가.
// TODO: 하드코딩 한글 → i18n, 실제 prod 노출 전 정리.
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, FlaskConical, Lock, ChevronRight, FileText, Paperclip } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectivePlan } from '@/lib/plans';
import { supabase, Pet } from '@/lib/supabase';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { trackEvent, trackPageViewDaily } from '@/lib/trackEvent';
import { useLabTests, LabTest } from '@/hooks/useLabTests';
import { LAB_TEMPLATES } from '@/lib/labCatalog';

const catLabel = (key: string) => LAB_TEMPLATES.find((t) => t.key === key)?.labelKo ?? key;

// 세션 중 마지막 선택 펫(메모리) — 다른 페이지 갔다 와도 유지. 기록장 sessionSelectedPetId 와 동일 패턴.
let sessionLabPetId: string | undefined = undefined;

export default function LabsPage() {
  const router = useRouter();
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
    // 펫 로딩 전엔 loading 유지 → 빈 상태("아직 등록한 검사 없음")가 잠깐 깜빡이는 것 방지.
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
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-sm font-semibold text-gray-700">검사 기록</h1>
        </header>
      </div>

      {!isPlus ? (
        <LockLanding onUpgrade={() => { trackEvent('lab_upgrade_click'); router.push('/profile/subscription'); }} />
      ) : (
        <div className="max-w-sm mx-auto px-4 pt-3">
          {/* 펫 선택 */}
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
              <p className="text-gray-400 text-sm">반려동물을 먼저 등록해주세요</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-16">
              <FlaskConical size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">아직 등록한 검사 결과가 없어요</p>
              <p className="text-gray-300 text-xs mt-1">+ 버튼으로 검사 결과지와 수치를 기록해보세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map((t) => (
                <button key={t.id} onClick={() => router.push(`/records/labs/${t.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left">
                  <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <FlaskConical size={18} className="text-indigo-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">
                      {(t.categories || []).map(catLabel).join(' · ') || '검사'}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                      <span className="truncate">{t.test_date}{t.hospital_name ? ` · ${t.hospital_name}` : ''} · 수치 {t.lab_values?.length ?? 0}개</span>
                      {(t.lab_test_files?.length ?? 0) > 0 && <Paperclip size={11} className="text-gray-300 flex-shrink-0" />}
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
          aria-label="검사 추가"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

function LockLanding({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="max-w-sm mx-auto px-5 pt-8 pb-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
        <FlaskConical size={30} className="text-indigo-500" />
      </div>
      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full mb-3">
        <Lock size={10} /> Plus 전용
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">검사 기록 관리</h2>
      <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
        검사 결과지와 주요 수치를 한곳에 모아<br />
        지난 검사와의 변화를 쉽게 확인해요.
      </p>

      <div className="text-left space-y-2.5 mb-7">
        {[
          '혈액·소변검사 결과지 사진/PDF 보관',
          'BUN·크레아티닌·ALT 등 주요 수치 입력',
          '이전 검사와 비교하고 추이 그래프로 확인',
          '신장·간·전해질 등 8개 검사 템플릿 제공',
        ].map((f) => (
          <div key={f} className="flex items-start gap-2">
            <FileText size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <span className="text-[13px] text-gray-600">{f}</span>
          </div>
        ))}
      </div>

      <button onClick={onUpgrade}
        className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-colors">
        Plus 보기
      </button>
      <p className="text-[11px] text-gray-300 mt-3 leading-relaxed">
        결과지 사진/PDF는 저장용량에 포함돼요<br />
        PawDex는 의학적 진단이 아닌 기록·정리 도구예요
      </p>
    </div>
  );
}
