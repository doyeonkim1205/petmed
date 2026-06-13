'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Calendar, RefreshCw, AlertTriangle, Dog, Cat, Wallet, Trash2, CheckSquare, X, Activity, Pill, Syringe } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { supabase } from '@/lib/supabase';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetFormFields } from '@/components/pets/PetFormFields';
import { PetFormState, EMPTY_PET_FORM, formToPayload, validatePetForm } from '@/lib/petForm';

type Tab = 'records' | 'calendar';
type RecordFilter = 'all' | 'symptom' | 'visit' | 'hospitalization' | 'daily';

const filterOptions: { id: RecordFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'symptom', label: '증상' },
  { id: 'visit', label: '진료' },
  { id: 'hospitalization', label: '입퇴원' },
  { id: 'daily', label: '일상' },
];

export default function RecordsPage() {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedPetId') || localStorage.getItem('defaultPetId') || null;
    }
    return null;
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, loading, error, fetchRecords, deleteRecords } = useHealthRecords(selectedPetId || undefined);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      await supabase.from('pets').insert({
        user_id: user.id,
        ...formToPayload(newPet),
      });
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
    if (petId) {
      localStorage.setItem('lastSelectedPetId', petId);
    } else {
      localStorage.removeItem('lastSelectedPetId');
    }
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
      setDeleteError('삭제 중 오류가 발생했습니다.');
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
    { id: 'records' as Tab, label: '기록', icon: ClipboardList },
    { id: 'calendar' as Tab, label: '캘린더', icon: Calendar },
  ];

  return (
    <div className="bg-white min-h-full pb-20 relative">
      <div className="sticky top-12 z-30 bg-white">
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
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab === 'records' && (
          selectMode ? (
            <div className="flex items-center justify-between px-4 py-2 max-w-sm mx-auto">
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
                  {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '전체 선택'}
                </span>
              </div>
              <button
                onClick={exitSelectMode}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto max-w-sm mx-auto">
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
                  {f.label}{recordFilter === f.id ? ` ${filterCounts[f.id]}` : ''}
                </button>
              ))}
              {filteredRecords.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex-shrink-0 ml-auto px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  선택
                </button>
              )}
            </div>
          )
        )}
      </div>

      {petCount === 0 ? (
        <div className="flex flex-col items-center px-6 py-16">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            {newPet.type === 'cat' ? <Cat size={28} className="text-blue-400" /> : <Dog size={28} className="text-blue-400" />}
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">반려동물을 등록해주세요</h2>
          <p className="text-sm text-gray-400 text-center mb-8">
            건강 기록을 시작하려면<br />먼저 반려동물을 등록해야 합니다.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <PetFormFields form={newPet} setForm={setNewPet} />
            {petFormError && <p className="text-xs text-red-500">{petFormError}</p>}
            <button
              onClick={handleAddPet}
              disabled={savingPet || !newPet.name.trim()}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {savingPet ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      ) : activeTab === 'records' ? (
        <div className="flex flex-col gap-2 p-4 max-w-sm mx-auto">
          {loading ? (
            <div className="py-20 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertTriangle size={40} className="mx-auto mb-3 text-orange-300" />
              <p className="text-gray-600 text-sm mb-1">기록을 불러올 수 없습니다</p>
              <p className="text-gray-400 text-xs mb-4">{error}</p>
              <button
                onClick={fetchRecords}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#fff] rounded-full text-sm font-medium"
              >
                <RefreshCw size={14} />
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* 건강 통계·복약·예방·의료비 — 기록 없어도 항상 노출 (기능 발견성). 2×2 그리드. */}
              <div className="grid grid-cols-2 gap-2 mb-1">
                <button
                  onClick={() => router.push('/records/stats')}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <Activity size={14} className="text-blue-500 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-gray-700">건강 통계</p>
                </button>
                <button
                  onClick={() => router.push('/records/meds')}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <Pill size={14} className="text-pink-500 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-gray-700">복약</p>
                </button>
                <button
                  onClick={() => router.push('/records/preventive')}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <Syringe size={14} className="text-sky-500 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-gray-700">예방</p>
                </button>
                <button
                  onClick={() => router.push('/records/expenses')}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <Wallet size={14} className="text-gray-500 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-gray-700">의료비</p>
                </button>
              </div>
              {records.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">아직 기록이 없습니다.</p>
                  <p className="text-gray-300 text-xs mt-1">+ 버튼을 눌러 첫 기록을 추가해보세요</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">해당 유형의 기록이 없습니다.</p>
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
            className="fixed bottom-20 left-1/2 -translate-x-1/2 h-12 px-6 bg-red-500 text-[#fff] rounded-full shadow-md flex items-center justify-center gap-2 hover:bg-red-600 active:scale-95 transition-all z-40 disabled:opacity-50"
          >
            <Trash2 size={18} />
            <span className="font-medium text-sm">{deleting ? '삭제 중...' : `${selectedIds.size}개 삭제`}</span>
          </button>
        ) : !selectMode && (
          <button
            onClick={() => router.push('/records/add')}
            className="fixed bottom-20 right-4 w-13 h-13 bg-blue-600 text-[#fff] rounded-full shadow-md flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
            style={{ right: 'max(1rem, calc(50% - 224px + 1rem))' }}
          >
            <Plus size={24} />
          </button>
        )
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title={`${selectedIds.size}개의 기록을 삭제할까요?`}
        message="삭제된 기록은 복구할 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmModal
        open={!!deleteError}
        title="삭제 실패"
        message={deleteError || ''}
        confirmLabel="확인"
        hideCancel
        onConfirm={() => setDeleteError(null)}
        onCancel={() => setDeleteError(null)}
      />
    </div>
  );
}
