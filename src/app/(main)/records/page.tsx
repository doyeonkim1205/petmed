'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, ClipboardList, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';

type Tab = 'records' | 'calendar';

export default function RecordsPage() {
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { user } = useAuth();
  const router = useRouter();
  const { records, loading } = useHealthRecords(selectedPetId || undefined);

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
          className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
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
        <PetSelector selectedPetId={selectedPetId} onSelect={setSelectedPetId} />
        <div className="flex border-t border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

      {activeTab === 'records' ? (
        <div className="flex flex-col gap-2 p-4">
          {loading ? (
            <div className="text-center py-20 text-gray-400 text-sm">로딩 중...</div>
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

      <button
        onClick={() => router.push('/records/add')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
        style={{ right: 'max(1rem, calc(50% - 224px + 1rem))' }}
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
