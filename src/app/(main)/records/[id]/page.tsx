'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Stethoscope, AlertCircle, FileEdit, Building2, Pill, Paperclip, ExternalLink, Download, Dog, Cat, Calendar, Image, FileText, PawPrint, Utensils, Footprints, CircleDot, Droplet, Smile, MoreHorizontal } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { HealthRecord, Medication, RecordFile, supabase, DailySubKind } from '@/lib/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';

const typeConfig = {
  symptom: { icon: AlertCircle, label: '증상 기록', color: 'bg-orange-100 text-orange-600' },
  visit: { icon: Stethoscope, label: '진료 기록', color: 'bg-blue-100 text-blue-600' },
  hospitalization: { icon: Building2, label: '입퇴원 기록', color: 'bg-emerald-100 text-emerald-600' },
  manual: { icon: FileEdit, label: '직접 입력', color: 'bg-green-100 text-green-600' },
  daily: { icon: PawPrint, label: '일상', color: 'bg-purple-100 text-purple-600' },
};

// 일상 세부 종류 → 라벨/아이콘 매핑 (상세 페이지 섹션 헤더).
const DAILY_SUB_META: Record<DailySubKind, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  meal:      { label: '식사', icon: Utensils },
  hydration: { label: '수분', icon: Droplet },
  walk:      { label: '산책', icon: Footprints },
  poop:      { label: '배변', icon: CircleDot },
  mood:      { label: '기분', icon: Smile },
  other:     { label: '기타', icon: MoreHorizontal },
};

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { getRecord, deleteRecord } = useHealthRecords();

  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      Sentry.captureException(error, {
        tags: { feature: 'records', action: 'fetch-detail' },
        extra: { recordId: id, userId: user?.id },
      });
      console.error('Error fetching record:', error);
      router.push('/records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!record) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!record) return;
    setShowDeleteConfirm(false);
    try {
      await deleteRecord(record.id);
      router.push('/records');
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'records', action: 'delete' },
        extra: { recordId: record?.id, userId: user?.id },
      });
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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 상세</h1>
        <div className="w-10" />
      </header>

      <div className="p-4 max-w-sm mx-auto w-full">
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
              <div className="flex items-center gap-0.5 ml-auto">
                <button onClick={() => router.push(`/records/${record.id}/edit`)} className="p-1.5 text-gray-700 hover:text-gray-900 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={handleDelete} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(record.visit_date)}</p>
          </div>
        </div>

        <h2 className={`text-xl font-bold text-gray-900 ${record.record_type === 'daily' ? 'mb-1' : 'mb-3'}`}>
          {record.record_type === 'daily'
            ? `${record.pets?.name ?? ''}의 일상 기록`
            : record.title}
        </h2>

        {record.record_type !== 'daily' && record.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-4">{record.description}</p>
        )}

        {/* v12 일상 — sub_kind 들을 옅은 회색 텍스트 + · 구분자로 미니멀하게 (A 안).
            제목 아래 보조 정보처럼 자연스럽게 묻혀, 본문 메모에 시선 집중. */}
        {record.record_type === 'daily' && (
          <div className="mb-4">
            {record.sub_entries && record.sub_entries.length > 0 && (
              <p className="text-xs text-gray-400 mb-3">
                {Array.from(new Set(record.sub_entries.map((e) => e.sub_kind)))
                  .map((kind) => DAILY_SUB_META[kind]?.label)
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {record.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{record.description}</p>
            ) : (
              // 기존 v11 데이터 호환 — description 비어있으면 sub_entries 의 memo 들 합쳐서 표시.
              record.sub_entries && record.sub_entries.some((e) => e.memo) && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {record.sub_entries.map((e) => e.memo).filter(Boolean).join('\n')}
                </p>
              )
            )}
          </div>
        )}

        <div className="space-y-2">
          {record.weight != null && Number(record.weight) > 0 && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">체중</span>
              <span className="text-sm font-medium">{record.weight}kg</span>
            </div>
          )}
          {record.symptom_time && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">증상 발생 시간</span>
              <span className="text-sm font-medium">{record.symptom_time}</span>
            </div>
          )}
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
          {record.discharge_date && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">퇴원일</span>
              <span className="text-sm font-medium text-emerald-600">{formatDate(record.discharge_date)}</span>
            </div>
          )}
          {!record.discharge_date && record.record_type === 'hospitalization' && (
            <div className="flex items-center justify-between py-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">퇴원일</span>
              <span className="text-sm font-medium text-orange-500">입원 중</span>
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
        <div className="p-4 max-w-sm mx-auto w-full">
          <h3 className="flex items-center gap-2 font-semibold text-sm text-gray-700 mb-3">
            <Pill size={16} className="text-blue-500" />
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
                {med.alarm_times && med.alarm_times.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400">알림</span>
                    {med.alarm_enabled === false && (
                      <span className="text-[10px] text-gray-400">(꺼짐)</span>
                    )}
                    {med.alarm_times.map((t: string, i: number) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          med.alarm_enabled === false
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {record.record_files && record.record_files.length > 0 && (
        <div className="p-4 max-w-sm mx-auto w-full">
          <h3 className="flex items-center gap-2 font-semibold text-sm text-gray-700 mb-3">
            <Paperclip size={16} className="text-blue-500" />
            첨부 파일
          </h3>
          <div className="space-y-2">
            {record.record_files.map((file) => {
              const { data: urlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path);
              const fileUrl = urlData.publicUrl;
              const { data: downloadUrlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path, { download: file.file_name });
              const downloadUrl = downloadUrlData.publicUrl;
              const isImage = file.file_type?.startsWith('image/');
              const FileIcon = isImage ? Image : FileText;

              return (
                <div key={file.id} className="rounded-lg border border-gray-100 overflow-hidden">
                  {isImage && (
                    <button
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="w-full block cursor-pointer"
                    >
                      <img
                        src={fileUrl}
                        alt={file.file_name}
                        className="w-full max-h-48 object-cover bg-gray-100"
                      />
                    </button>
                  )}
                  <div className="flex items-center gap-3 p-3 bg-gray-50">
                    <FileIcon size={16} className={isImage ? 'text-green-500' : 'text-blue-500'} />
                    <button
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="flex-1 text-sm text-gray-700 truncate text-left hover:text-blue-600 transition-colors"
                    >
                      {file.file_name}
                    </button>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {(file.file_size / 1024).toFixed(0)}KB
                    </span>
                    <a
                      href={downloadUrl}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="다운로드"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="새 탭에서 열기"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title="이 기록을 삭제할까요?"
        message="삭제된 기록은 복구할 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
