'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, ClipboardList, Calendar, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { PetSelector } from '@/components/records/PetSelector';
import { RecordCard } from '@/components/records/RecordCard';
import { CalendarView } from '@/components/records/CalendarView';
import { MedicationCheckList } from '@/components/records/MedicationCheckList';

type Tab = 'records' | 'calendar';

// Diagnostic panel — shows exact auth/query state for debugging
function DiagnosticPanel({ user, authLoading, records, loading, error, selectedPetId }: {
  user: any; authLoading: boolean; records: any[]; loading: boolean; error: string | null; selectedPetId: string | null;
}) {
  const [sessionInfo, setSessionInfo] = useState<string>('checking...');
  const [directQuery, setDirectQuery] = useState<string>('checking...');

  useEffect(() => {
    // Check 1: Does supabase client have a session?
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const exp = new Date(JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).exp * 1000);
        setSessionInfo(`YES (expires: ${exp.toLocaleTimeString()})`);
      } else {
        setSessionInfo('NO SESSION');
      }
    }).catch(e => setSessionInfo(`ERROR: ${e.message}`));

    // Check 2: Direct query to pets table
    if (user?.id) {
      supabase.from('pets').select('id, name').eq('user_id', user.id).then(({ data, error: e }) => {
        if (e) setDirectQuery(`ERROR: ${e.message} (code: ${e.code})`);
        else setDirectQuery(`${data?.length ?? 0} pets: ${data?.map(p => p.name).join(', ') || 'none'}`);
      });
    } else {
      setDirectQuery('no user id');
    }
  }, [user]);

  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 m-4 text-xs font-mono space-y-1">
      <p className="font-bold text-yellow-800">🔍 진단 패널 (디버깅용 - 추후 제거)</p>
      <p>authLoading: <b>{String(authLoading)}</b></p>
      <p>user: <b>{user ? `${user.email} (${user.id.slice(0,8)}...)` : 'null'}</b></p>
      <p>session: <b>{sessionInfo}</b></p>
      <p>selectedPetId: <b>{selectedPetId || 'null (전체)'}</b></p>
      <p>records loading: <b>{String(loading)}</b></p>
      <p>records count: <b>{records.length}</b></p>
      <p>records error: <b>{error || 'none'}</b></p>
      <p>direct pets query: <b>{directQuery}</b></p>
    </div>
  );
}

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, loading, error, fetchRecords } = useHealthRecords(selectedPetId || undefined);

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
      <DiagnosticPanel user={user} authLoading={authLoading} records={records} loading={loading} error={error} selectedPetId={selectedPetId} />
      <div className="bg-white sticky top-14 z-30 shadow-sm">
        <PetSelector selectedPetId={selectedPetId} onSelect={handlePetSelect} />
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

      {activeTab === 'records' ? (
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
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
