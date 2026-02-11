'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Edit2, Trash2, Stethoscope, AlertCircle, FileEdit, Pill, Paperclip, ExternalLink, Dog, Cat, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { HealthRecord, Medication, RecordFile } from '@/lib/supabase';

const typeConfig = {
  symptom: { icon: AlertCircle, label: '증상 기록', color: 'bg-orange-100 text-orange-600' },
  visit: { icon: Stethoscope, label: '진료 기록', color: 'bg-blue-100 text-blue-600' },
  manual: { icon: FileEdit, label: '직접 입력', color: 'bg-green-100 text-green-600' },
};

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { getRecord, deleteRecord } = useHealthRecords();

  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadRecord();
    }
  }, [id, user]);

  const loadRecord = async () => {
    try {
      const data = await getRecord(id);
      setRecord(data);
    } catch (error) {
      console.error('Error fetching record:', error);
      router.push('/records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!record || !confirm('정말 이 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteRecord(record.id);
      router.push('/records');
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('ko-KR').format(cost) + '원';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">기록을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const config = typeConfig[record.record_type] || typeConfig.manual;
  const TypeIcon = config.icon;
  const PetIcon = record.pets?.type === 'cat' ? Cat : Dog;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">기록 상세</h1>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 -mr-2">
            <MoreVertical className="w-6 h-6" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border rounded-lg shadow-lg py-1 min-w-32 z-20">
              <button
                onClick={() => { setShowMenu(false); router.push(`/records/${record.id}/edit`); }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 size={16} /> 수정하기
              </button>
              <button
                onClick={() => { setShowMenu(false); handleDelete(); }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
              >
                <Trash2 size={16} /> 삭제하기
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="bg-white p-4 mb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.color}`}>
            <TypeIcon size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.color}`}>
                {config.label}
              </span>
              {record.pets && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <PetIcon size={14} /> {record.pets.name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(record.visit_date)}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-3">{record.title}</h2>

        {record.description && (
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed mb-4">{record.description}</p>
        )}

        <div className="space-y-2">
          {record.hospital_name && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">병원</span>
              <span className="text-sm font-medium">{record.hospital_name}</span>
            </div>
          )}
          {record.cost != null && record.cost > 0 && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">비용</span>
              <span className="text-sm font-medium text-blue-600">{formatCost(record.cost)}</span>
            </div>
          )}
          {record.next_appointment_date && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar size={14} /> 다음 예약일
              </span>
              <span className="text-sm font-medium text-purple-600">{formatDate(record.next_appointment_date)}</span>
            </div>
          )}
        </div>

        {record.ai_summary && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1">AI 요약</p>
            <p className="text-sm text-gray-700">{record.ai_summary}</p>
          </div>
        )}
      </div>

      {/* Medications */}
      {record.medications && record.medications.length > 0 && (
        <div className="bg-white p-4 mb-2">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <Pill size={18} className="text-blue-600" />
            투약 정보
          </h3>
          <div className="space-y-2">
            {record.medications.map((med) => (
              <div key={med.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  {med.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: med.color }} />
                  )}
                  <p className="font-medium text-sm text-gray-900">{med.name}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  {med.dosage && <span>{med.dosage}</span>}
                  <span>{med.frequency}</span>
                  <span>
                    {med.start_date}
                    {med.end_date ? ` ~ ${med.end_date}` : ' ~'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {record.record_files && record.record_files.length > 0 && (
        <div className="bg-white p-4 mb-2">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <Paperclip size={18} className="text-blue-600" />
            첨부 파일
          </h3>
          <div className="space-y-2">
            {record.record_files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Paperclip size={16} className="text-gray-400" />
                <span className="flex-1 text-sm text-gray-700 truncate">{file.file_name}</span>
                <span className="text-xs text-gray-400">
                  {(file.file_size / 1024).toFixed(0)}KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
