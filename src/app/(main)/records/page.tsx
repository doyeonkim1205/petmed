'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, ClipboardList, Calendar, RefreshCw, AlertTriangle, Dog, Cat, Wallet, ChevronRight, Trash2, CheckSquare, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { supabase } from '@/lib/supabase';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';

type Tab = 'records' | 'calendar';
type RecordFilter = 'all' | 'symptom' | 'visit' | 'hospitalization';

const filterOptions: { id: RecordFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'symptom', label: '증상' },
  { id: 'visit', label: '진료' },
  { id: 'hospitalization', label: '입퇴원' },
];

export default function RecordsPage() {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedPetId') || localStorage.getItem('defaultPetId') || null;
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recordsActiveTab');
      if (saved === 'records' || saved === 'calendar') return saved;
    }
    return 'records';
  });
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
  const [newPet, setNewPet] = useState({ name: '', type: 'dog' as 'dog' | 'cat', breed: '', birth_date: '' });
  const [savingPet, setSavingPet] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, loading, error, fetchRecords, deleteRecords } = useHealthRecords(selectedPetId || undefined);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const handleAddPet = async () => {
    if (!user || !newPet.name.trim()) return;
    setSavingPet(true);
    try {
      await supabase.from('pets').insert({
        user_id: user.id,
        name: newPet.name.trim(),
        type: newPet.type,
        breed: newPet.breed.trim() || null,
        birth_date: newPet.birth_date || null,
      });
      setNewPet({ name: '', type: 'dog', breed: '', birth_date: '' });
      setPetRefreshKey(k => k + 1);
    } catch (err) {
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
    localStorage.setItem('recordsActiveTab', tab);
  };

  const handleFilterChange = (filter: RecordFilter) => {
    setRecordFilter(filter);
    localStorage.setItem('recordFilter', filter);
  };

  const filteredRecords = recordFilter === 'all'
    ? records
    : records.filter(r => r.record_type === recordFilter);

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
    if (!confirm(`${selectedIds.size}개의 기록을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await deleteRecords(Array.from(selectedIds));
      exitSelectMode();
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    let total = 0;
    let count = 0;
    for (const r of records) {
      if (r.cost && r.cost > 0) {
        const d = new Date(r.visit_date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          total += r.cost;
          count++;
        }
      }
    }
    return { total, count };
  }, [records]);

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

  if (!user) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <User size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">로그인이 필요합니다</h2>
        <p className="text-sm text-gray-400 text-center mb-8">
          건강 기록장을 이용하려면<br />로그인해주세요.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm transition-colors"
        >
          로그인하기
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'records' as Tab, label: '기록', icon: ClipboardList },
    { id: 'calendar' as Tab, label: '캘린더', icon: Calendar },
  ];

  return (
    <div className="bg-white min-h-full pb-20 relative">
      <div className="sticky top-14 z-30 bg-white">
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
                  {f.label}
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
            <input
              type="text"
              placeholder="이름"
              value={newPet.name}
              onChange={e => setNewPet(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewPet(p => ({ ...p, type: 'dog' }))}
                className={`flex-1 h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                  newPet.type === 'dog' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                <Dog size={14} /> 강아지
              </button>
              <button
                type="button"
                onClick={() => setNewPet(p => ({ ...p, type: 'cat' }))}
                className={`flex-1 h-10 rounded-xl border font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                  newPet.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                <Cat size={14} /> 고양이
              </button>
            </div>
            <input
              type="text"
              placeholder="품종 (선택)"
              value={newPet.breed}
              onChange={e => setNewPet(p => ({ ...p, breed: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div>
              <label className="text-xs text-gray-400 mb-1 block">생년월일 (선택)</label>
              <input
                type="date"
                value={newPet.birth_date}
                onChange={e => setNewPet(p => ({ ...p, birth_date: e.target.value }))}
                className={`w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 ${!newPet.birth_date ? 'date-empty' : ''}`}
              />
            </div>
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
          ) : records.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">아직 기록이 없습니다.</p>
              <p className="text-gray-300 text-xs mt-1">+ 버튼을 눌러 첫 기록을 추가해보세요</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">해당 유형의 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              {monthlyStats.total > 0 && (
                <button
                  onClick={() => router.push('/records/stats')}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-blue-50 border border-blue-100 mb-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <Wallet size={16} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-blue-500 font-medium">이번 달 의료비</p>
                      <p className="text-base font-bold text-gray-800">
                        {new Intl.NumberFormat('ko-KR').format(monthlyStats.total)}원
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-blue-400">
                    <span>{monthlyStats.count}건의 기록</span>
                    <ChevronRight size={14} />
                  </div>
                </button>
              )}
              {filteredRecords.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onClick={() => router.push(`/records/${record.id}`)}
                  selectMode={selectMode}
                  selected={selectedIds.has(record.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white max-w-sm mx-auto">
          <CalendarView
            records={records}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
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
    </div>
  );
}
