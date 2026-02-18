'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, ClipboardList, Calendar, RefreshCw, AlertTriangle, Dog, Cat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { supabase } from '@/lib/supabase';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';

type Tab = 'records' | 'calendar';

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [petCount, setPetCount] = useState<number | null>(null);
  const [petRefreshKey, setPetRefreshKey] = useState(0);
  const [newPet, setNewPet] = useState({ name: '', type: 'dog' as 'dog' | 'cat', breed: '', birth_date: '' });
  const [savingPet, setSavingPet] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, loading, error, fetchRecords } = useHealthRecords(selectedPetId || undefined);

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

  if (authLoading) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] animate-pulse p-4">
        <div className="h-12 bg-gray-200 rounded-lg mb-3" />
        <div className="h-10 bg-gray-200 rounded-lg mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <User size={40} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-500 text-center mb-6">
          건강 기록장을 이용하려면<br />로그인해주세요.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-lg font-medium"
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
    <div className="bg-gray-50 min-h-full pb-20 relative">
      <div className="bg-white sticky top-14 z-30 shadow-sm">
        <PetSelector key={petRefreshKey} selectedPetId={selectedPetId} onSelect={handlePetSelect} onPetsLoaded={setPetCount} />
        <div className="flex border-t border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {petCount === 0 ? (
        <div className="flex flex-col items-center px-6 py-16">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Dog size={40} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">반려동물을 등록해주세요</h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            건강 기록을 시작하려면<br />먼저 반려동물을 등록해야 합니다.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <input
              type="text"
              placeholder="이름"
              value={newPet.name}
              onChange={e => setNewPet(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewPet(p => ({ ...p, type: 'dog' }))}
                className={`flex-1 h-11 rounded-lg border font-medium text-sm flex items-center justify-center gap-1.5 ${
                  newPet.type === 'dog' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                <Dog size={16} /> 강아지
              </button>
              <button
                type="button"
                onClick={() => setNewPet(p => ({ ...p, type: 'cat' }))}
                className={`flex-1 h-11 rounded-lg border font-medium text-sm flex items-center justify-center gap-1.5 ${
                  newPet.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                <Cat size={16} /> 고양이
              </button>
            </div>
            <input
              type="text"
              placeholder="품종 (선택)"
              value={newPet.breed}
              onChange={e => setNewPet(p => ({ ...p, breed: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              placeholder="생년월일 (선택)"
              value={newPet.birth_date}
              onChange={e => setNewPet(p => ({ ...p, birth_date: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddPet}
              disabled={savingPet || !newPet.name.trim()}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {savingPet ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      ) : activeTab === 'records' ? (
        <div className="flex flex-col gap-2 p-4">
          {loading ? (
            <div className="py-20 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertTriangle size={48} className="mx-auto mb-3 text-orange-400" />
              <p className="text-gray-600 text-sm mb-1">기록을 불러올 수 없습니다</p>
              <p className="text-gray-400 text-xs mb-4">{error}</p>
              <button
                onClick={fetchRecords}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-[#fff] rounded-lg text-sm font-medium"
              >
                <RefreshCw size={14} />
                다시 시도
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardList size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 text-sm">아직 기록이 없습니다.</p>
              <p className="text-gray-400 text-xs mt-1">+ 버튼을 눌러 첫 기록을 추가해보세요</p>
            </div>
          ) : (
            records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                onClick={() => router.push(`/records/${record.id}`)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="bg-white">
          <CalendarView
            records={records}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
          <div className="border-t border-gray-100">
            <MedicationCheckList petId={selectedPetId || undefined} />
          </div>
        </div>
      )}

      {petCount !== 0 && (
        <button
          onClick={() => router.push('/records/add')}
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-[#fff] rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
          style={{ right: 'max(1rem, calc(50% - 224px + 1rem))' }}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}
