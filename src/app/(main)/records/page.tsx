'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, ClipboardList, Calendar, RefreshCw, AlertTriangle, Dog, Cat, Wallet, Trash2, X, Activity, Pill, Syringe, FlaskConical, Lock } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectivePlan } from '@/lib/plans';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { supabase } from '@/lib/supabase';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetFormFields } from '@/components/pets/PetFormFields';
import { PetFormState, EMPTY_PET_FORM, formToPayload, validatePetForm } from '@/lib/petForm';
import { addWeightLog, syncPetWeightCache } from '@/lib/petWeight';
import { readDefaultPetId } from '@/lib/petSort';

type Tab = 'records' | 'calendar';
type RecordFilter = 'all' | 'symptom' | 'visit' | 'hospitalization' | 'daily';

// 라벨은 messages 로 분리 — id 로 t('record.typeShort.*' | 'common.all') 참조.
const filterOptions: { id: RecordFilter }[] = [
  { id: 'all' },
  { id: 'symptom' },
  { id: 'visit' },
  { id: 'hospitalization' },
  { id: 'daily' },
];

// 기록장 상단 빠른 접근. 평소엔 2×2 카드, 스크롤로 가려지면 헤더에 슬림 1줄 바로 고정.
// 라벨/숏라벨은 messages(record.module.* / record.moduleShort.*)로 분리 — key 로 참조.
const QUICK_LINKS = [
  { icon: Activity, key: 'stats', color: 'text-blue-500', href: '/records/stats' },
  { icon: Wallet, key: 'expenses', color: 'text-gray-500', href: '/records/expenses' },
  { icon: Syringe, key: 'preventive', color: 'text-sky-500', href: '/records/preventive' },
  { icon: Pill, key: 'meds', color: 'text-pink-500', href: '/records/meds' },
] as const;

// 기록장 펫 필터 — 앱 실행 중(모듈 생존 동안)에만 유지되는 메모리 상태.
// localStorage 를 쓰지 않아 앱을 완전히 새로 시작(full reload/콜드스타트)하면 모듈이
// 재평가되며 리셋 → 초기값은 기본 반려동물(defaultPetId).
// 효과: "앱 켜면 기본펫, 쓰는 동안 마지막 선택 유지"(다른 페이지 갔다 와도 유지).
// undefined = 이번 세션에 아직 선택 안 함(→ 기본펫 사용), null = 명시적 '전체'.
let sessionSelectedPetId: string | null | undefined = undefined;

export default function RecordsPage() {
  const t = useTranslations();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    // 세션 중 마지막 선택(메모리) 우선, 이번 세션 첫 진입이면 기본펫으로 시작.
    if (sessionSelectedPetId !== undefined) return sessionSelectedPetId;
    return readDefaultPetId();
  });
  const [activeTab, setActiveTab] = useState<Tab>('records');
  // 정적 프리렌더 컴포넌트에선 useState lazy initializer 의 window/URL 접근이 빌드 시점
  // 서버 값으로 굳어 클라이언트 URL 을 못 읽음 → 마운트 후 useEffect 로 탭 결정.
  // "기록장" 진입(파라미터 없음)은 항상 기록장 탭. 캘린더는 ?tab=calendar 로만 진입.
  // (localStorage 복원은 제거 — 마지막 탭이 캘린더면 "기록장" 눌러도 캘린더가 뜨던 버그)
  useEffect(() => {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'calendar') setActiveTab('calendar');
  }, []);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recordFilter');
      if (saved && filterOptions.some(f => f.id === saved)) return saved as RecordFilter;
    }
    return 'all';
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [petCount, setPetCount] = useState<number | null>(null);
  const [petRefreshKey, setPetRefreshKey] = useState(0);
  const [newPet, setNewPet] = useState<PetFormState>(EMPTY_PET_FORM);
  const [petFormError, setPetFormError] = useState<string | null>(null);
  const [savingPet, setSavingPet] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const isPlus = getEffectivePlan(profile?.plan) === 'plus';
  const router = useRouter();
  const { records, loading, error, fetchRecords, deleteRecords } = useHealthRecords(selectedPetId || undefined);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const [showQuickBar, setShowQuickBar] = useState(false);
  // 2단 고정: 필터(검사 아래 선+칩)의 sticky top = 글로벌헤더(48) + 기록헤더(펫+탭) 높이. 아래 effect에서 실측.
  const [stickyTop, setStickyTop] = useState(88);
  // 검사 수치 카드 = 기능 미완성 → 프로덕션(pawdex.store)에선 숨김, 프리뷰/로컬에서만 시안 노출.
  const [showLabCard, setShowLabCard] = useState(false);

  const handleAddPet = async () => {
    if (!user) return;
    const validationError = validatePetForm(newPet);
    if (validationError) {
      setPetFormError(validationError);
      return;
    }
    setPetFormError(null);
    setSavingPet(true);
    try {
      const payload = formToPayload(newPet);
      const { data: created } = await supabase.from('pets').insert({
        user_id: user.id,
        ...payload,
      }).select('id').single();
      // 등록 무게를 히스토리(weight_logs) 첫 기록으로 보존 + pets.weight 캐시 동기화.
      if (created && payload.weight) {
        await addWeightLog(user.id, created.id, payload.weight);
        await syncPetWeightCache(created.id);
      }
      setNewPet(EMPTY_PET_FORM);
      setPetRefreshKey(k => k + 1);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'pets', action: 'add' },
        extra: { userId: user?.id },
      });
      console.error('Error adding pet:', err);
    } finally {
      setSavingPet(false);
    }
  };

  const handlePetSelect = (petId: string | null) => {
    setSelectedPetId(petId);
    // 메모리에만 유지(localStorage 안 씀) → 앱 새 시작 시 기본펫으로 리셋.
    sessionSelectedPetId = petId;
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleFilterChange = (filter: RecordFilter) => {
    setRecordFilter(filter);
    localStorage.setItem('recordFilter', filter);
  };

  const filteredRecords = recordFilter === 'all'
    ? records
    : records.filter(r => r.record_type === recordFilter);

  // 필터 뱃지에 표시할 건수 — 선택된 뱃지에만 옆에 숫자 보이게 사용.
  const filterCounts = (() => {
    const c: Record<RecordFilter, number> = { all: records.length, symptom: 0, visit: 0, hospitalization: 0, daily: 0 };
    for (const r of records) {
      if (r.record_type in c) c[r.record_type as RecordFilter] += 1;
    }
    return c;
  })();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteRecords(Array.from(selectedIds));
      exitSelectMode();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'records', action: 'bulk-delete' },
        extra: { userId: user?.id, count: selectedIds.size },
      });
      console.error('Bulk delete error:', err);
      setDeleteError(t('record.list.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  // long-press 핸들러: 카드를 길게 누르면 selectMode 진입 + 그 카드 선택.
  const handleLongPress = (id: string) => {
    if (selectMode) return;
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  // 상단 빠른 접근 — 2×2가 스크롤로 헤더 밑에 가려지면 슬림 바로 고정 노출.
  useEffect(() => {
    if (activeTab !== 'records') { setShowQuickBar(false); return; }
    const el = quickRef.current;
    if (!el) { setShowQuickBar(false); return; }
    const headerH = headerRef.current?.offsetHeight ?? 0;
    setStickyTop(48 + headerH); // 필터 tier2 가 기록헤더(펫+탭) 밑에 딱 걸리도록
    const obs = new IntersectionObserver(
      ([entry]) => setShowQuickBar(!entry.isIntersecting),
      { rootMargin: `-${48 + headerH}px 0px 0px 0px`, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeTab, loading, error, selectMode, petCount]);

  // 검사 수치 시안: 프로덕션 도메인(pawdex.store)에선 숨기고, 프리뷰/로컬에서만 노출(기능 미완성).
  useEffect(() => {
    setShowLabCard(window.location.hostname !== 'pawdex.store');
  }, []);

  if (authLoading) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] animate-pulse p-4 max-w-sm mx-auto">
        <div className="h-10 bg-gray-100 rounded-full mb-4 mt-4" />
        <div className="space-y-3">
          <div className="h-20 bg-gray-50 rounded-xl" />
          <div className="h-20 bg-gray-50 rounded-xl" />
        </div>
      </div>
    );
  }

  // (main) 레이아웃에서 미인증 유저를 /login 으로 리다이렉트함 → 여기 도달 시 user 는 항상 있음
  // TypeScript 타입 narrowing 용 가드
  if (!user) return null;

  const tabs = [
    { id: 'records' as Tab, icon: ClipboardList },
    { id: 'calendar' as Tab, icon: Calendar },
  ];

  return (
    <div className="bg-white min-h-full pb-20 relative">
      <div className="sticky top-12 z-30 bg-white">
        <div ref={headerRef}>
        <PetSelector key={petRefreshKey} selectedPetId={selectedPetId} onSelect={handlePetSelect} onPetsLoaded={setPetCount} />
        <div className="flex max-w-sm mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={14} />
                {t(`record.tab.${tab.id}`)}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {petCount === 0 ? (
        <div className="flex flex-col items-center px-6 py-16">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            {newPet.type === 'cat' ? <Cat size={28} className="text-blue-400" /> : <Dog size={28} className="text-blue-400" />}
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">{t('record.noPets.title')}</h2>
          <p className="text-sm text-gray-400 text-center mb-8">
            {t.rich('record.noPets.message', { br: () => <br /> })}
          </p>

          <div className="w-full max-w-sm space-y-3">
            <PetFormFields form={newPet} setForm={setNewPet} />
            {petFormError && <p className="text-xs text-red-500">{petFormError}</p>}
            <button
              onClick={handleAddPet}
              disabled={savingPet || !newPet.name.trim()}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {savingPet ? t('record.noPets.registering') : t('record.noPets.register')}
            </button>
          </div>
        </div>
      ) : activeTab === 'records' ? (
        <div className="flex flex-col gap-2 px-4 pt-2.5 pb-4 max-w-sm mx-auto">
          {loading ? (
            <div className="py-20 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertTriangle size={40} className="mx-auto mb-3 text-orange-300" />
              <p className="text-gray-600 text-sm mb-1">{t('record.list.loadError')}</p>
              <p className="text-gray-400 text-xs mb-4">{error}</p>
              <button
                onClick={fetchRecords}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#fff] rounded-full text-sm font-medium"
              >
                <RefreshCw size={14} />
                {t('common.retry')}
              </button>
            </div>
          ) : (
            <>
              {/* 건강 통계·지출·예방·복약 — 기록 없어도 항상 노출. 스크롤 시 헤더 슬림바로 고정. */}
              <div ref={quickRef} className="grid grid-cols-2 gap-2 mb-1">
                {QUICK_LINKS.map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.href}
                      onClick={() => router.push(q.href)}
                      className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white border border-gray-200"
                    >
                      <Icon size={14} className={`${q.color} flex-shrink-0`} />
                      <p className="text-[13px] font-bold text-gray-700">{t(`record.module.${q.key}`)}</p>
                    </button>
                  );
                })}
              </div>

              {/* 검사 수치 (Plus 전용) — 시안. 프로덕션(pawdex.store)에선 숨김(기능 미완성), 프리뷰에서만 노출. TODO: /records/labs 연결 + i18n */}
              {showLabCard && (
              <button
                onClick={() => router.push('/profile/subscription')}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border active:scale-[0.98] transition-transform ${
                  isPlus ? 'border-gray-200 bg-white' : 'border-indigo-200 bg-indigo-50'
                }`}
              >
                <FlaskConical size={15} className="text-indigo-500 flex-shrink-0" />
                <p className="text-[13px] font-bold text-gray-700">검사 수치</p>
                {!isPlus && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                    <Lock size={9} /> Plus 전용
                  </span>
                )}
              </button>
              )}

              {/* 2단 고정: 검사 아래 '선' + 필터(선택). 스크롤 시 슬림 모듈바+선+필터가 기록헤더 밑에 딱 고정. 검사·그리드는 스크롤로 사라짐. */}
              <div className="sticky z-20 bg-white -mx-4 px-4" style={{ top: stickyTop }}>
                {!selectMode && showQuickBar && (
                  <div className="flex gap-1.5 pt-1 pb-2 max-w-sm mx-auto">
                    {QUICK_LINKS.map((q) => {
                      const Icon = q.icon;
                      return (
                        <button
                          key={q.href}
                          onClick={() => router.push(q.href)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white border border-gray-200 active:bg-gray-50 transition-colors"
                        >
                          <Icon size={13} className={`${q.color} flex-shrink-0`} />
                          <span className="text-[11px] font-bold text-gray-600">{t(`record.moduleShort.${q.key}`)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="border-t border-gray-100 max-w-sm mx-auto" />
                {selectMode ? (
                  <div className="flex items-center justify-between py-2 max-w-sm mx-auto">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          filteredRecords.length > 0 && selectedIds.size === filteredRecords.length
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {filteredRecords.length > 0 && selectedIds.size === filteredRecords.length && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-600">
                        {selectedIds.size > 0 ? t('record.select.count', { count: selectedIds.size }) : t('record.select.all')}
                      </span>
                    </div>
                    <button
                      onClick={exitSelectMode}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <X size={14} />
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 py-2 overflow-x-auto max-w-sm mx-auto">
                    {filterOptions.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleFilterChange(f.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          recordFilter === f.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {f.id === 'all' ? t('common.all') : t(`record.typeShort.${f.id}`)}{recordFilter === f.id ? ` ${filterCounts[f.id]}` : ''}
                      </button>
                    ))}
                    {filteredRecords.length > 0 && (
                      <button
                        onClick={() => setSelectMode(true)}
                        className="flex-shrink-0 ml-auto px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        {t('record.select.enter')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {records.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">{t('record.list.empty')}</p>
                  <p className="text-gray-300 text-xs mt-1">{t('record.list.emptyHint')}</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">{t('record.list.emptyFiltered')}</p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    onClick={() => router.push(`/records/${record.id}`)}
                    selectMode={selectMode}
                    selected={selectedIds.has(record.id)}
                    onSelect={toggleSelect}
                    onLongPress={handleLongPress}
                  />
                ))
              )}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white max-w-sm mx-auto">
          {/* 일상 기록은 캘린더에 노출 X — 메모성 빈도가 높아 캘린더가 빽빽해지면
              정작 중요한 진료/예약/퇴원 이벤트가 묻힘. 리스트(기록장 탭)에선 그대로 보임. */}
          <CalendarView
            records={records.filter((r) => r.record_type !== 'daily')}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onRecordClick={(id) => router.push(`/records/${id}`)}
          />
          <div className="border-t border-gray-100">
            <MedicationCheckList petId={selectedPetId || undefined} date={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`} />
          </div>
        </div>
      )}

      {petCount !== 0 && (
        selectMode && selectedIds.size > 0 ? (
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="fixed left-1/2 -translate-x-1/2 h-12 px-6 bg-red-500 text-[#fff] rounded-full shadow-md flex items-center justify-center gap-2 hover:bg-red-600 active:scale-95 transition-all z-40 disabled:opacity-50"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <Trash2 size={18} />
            <span className="font-medium text-sm">{deleting ? t('record.select.deleting') : t('record.select.deleteCount', { count: selectedIds.size })}</span>
          </button>
        ) : !selectMode && (
          <button
            onClick={() => router.push('/records/add')}
            className="fixed right-4 w-13 h-13 bg-blue-600 text-[#fff] rounded-full shadow-md flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
            style={{ right: 'max(1rem, calc(50% - 224px + 1rem))', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <Plus size={24} />
          </button>
        )
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title={t('record.delete.confirmTitle', { count: selectedIds.size })}
        message={t('record.delete.confirmMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmModal
        open={!!deleteError}
        title={t('record.delete.failTitle')}
        message={deleteError || ''}
        confirmLabel={t('common.confirm')}
        hideCancel
        onConfirm={() => setDeleteError(null)}
        onCancel={() => setDeleteError(null)}
      />
    </div>
  );
}
