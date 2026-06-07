'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Stethoscope, AlertCircle, FileEdit, Building2, Pill, Paperclip, Download, Dog, Cat, Calendar, FileText, PawPrint, Utensils, Footprints, CircleDot, Droplet, Smile, MoreHorizontal, X } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { HealthRecord, Medication, RecordFile, supabase, DailySubKind } from '@/lib/supabase';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SafeImage } from '@/components/ui/SafeImage';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// 첨부 파일 1시간 유효 signedUrl 발급 — bucket 이 private 으로 전환된 후 RLS 통과한 사용자만 받음.
async function createDisplayUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('medical-files').createSignedUrl(filePath, 3600);
  if (error || !data) throw error ?? new Error('signed url failed');
  return data.signedUrl;
}

// 다운로드는 click 시점에 60초짜리 단명 URL 발급 → 즉시 다운로드. DOM 에 href 영구 노출 X.
async function triggerDownload(filePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from('medical-files')
    .createSignedUrl(filePath, 60, { download: fileName });
  if (error || !data) return;
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

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
  // 파일 ID → display 용 signedUrl. record 로드 시 일괄 발급, SafeImage 의 onError 재발급 시도 동기화.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  // 모달 미리보기 — 본문 썸네일 클릭 시 큰 화면 + 핀치/더블탭 줌. fileId 로 fileUrls 에서 lookup.
  const [previewFile, setPreviewFile] = useState<{ fileId: string; name: string; isImage: boolean } | null>(null);

  useEffect(() => {
    if (id && user) {
      loadRecord();
    }
  }, [id, user]);

  const loadRecord = async () => {
    try {
      const data = await getRecord(id);
      setRecord(data);
      if (data?.record_files && data.record_files.length > 0) {
        // 파일별 signedUrl 일괄 발급. 하나 실패해도 나머지는 진행.
        const entries = await Promise.all(
          data.record_files.map(async (f: RecordFile) => {
            try {
              return [f.id, await createDisplayUrl(f.file_path)] as const;
            } catch {
              return [f.id, ''] as const;
            }
          })
        );
        setFileUrls(Object.fromEntries(entries));
      }
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

  // SafeImage onError 시 호출 — 새 signedUrl 발급 + state 동기화.
  const refetchUrl = async (file: RecordFile): Promise<string> => {
    const url = await createDisplayUrl(file.file_path);
    setFileUrls((prev) => ({ ...prev, [file.id]: url }));
    return url;
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
      // 홈 브리핑 캐시 무효화 — 삭제된 기록이 즉시 메트릭에서 제외.
      if (user?.id) {
        const { invalidateHealthBriefing } = await import('@/lib/swrCache');
        invalidateHealthBriefing(user.id);
      }
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
    return <LoadingScreen inMain />;
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
      <header className="relative flex items-center justify-center px-4 h-[60px] bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 상세</h1>
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

        <h2 className={`text-base font-bold text-gray-900 ${record.record_type === 'daily' ? 'mb-1' : 'mb-3'}`}>
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
            {record.record_type === 'daily' ? '오늘을 담은 한 컷' : '첨부 파일'}
          </h3>
          <div className="space-y-2">
            {record.record_files.map((file) => {
              const fileUrl = fileUrls[file.id] || '';
              const isImage = file.file_type?.startsWith('image/');
              const openPreview = () => setPreviewFile({ fileId: file.id, name: file.file_name, isImage: !!isImage });

              // 이미지: 사진만 크게 + 좌하단 둥근 다운로드 버튼 (이름/용량/바 제거 — 사진이 곧 콘텐츠)
              if (isImage) {
                return (
                  <div key={file.id} className="relative rounded-lg border border-gray-100 overflow-hidden">
                    <button type="button" onClick={openPreview} className="w-full block cursor-pointer">
                      <SafeImage
                        src={fileUrl}
                        alt={file.file_name}
                        onRefetchUrl={() => refetchUrl(file)}
                        className="w-full h-48"
                        imgClassName="w-full h-48 object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); triggerDownload(file.file_path, file.file_name); }}
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
                      title="다운로드"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                );
              }

              // 비이미지(PDF 등): 미리보기 불가 → 이름 + 다운로드 행 유지
              return (
                <div key={file.id} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                    <FileText size={14} className="text-blue-500 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={openPreview}
                      className="flex-1 text-xs text-gray-700 truncate text-left hover:text-blue-600 transition-colors"
                    >
                      {file.file_name}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerDownload(file.file_path, file.file_name)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="다운로드"
                    >
                      <Download size={14} />
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

      {previewFile && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewFile(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white"
            aria-label="닫기"
          >
            <X size={24} />
          </button>
          {previewFile.isImage ? (
            <div
              className="w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={5}
                doubleClick={{ mode: 'toggle', step: 2 }}
                wheel={{ step: 0.2 }}
                pinch={{ step: 5 }}
              >
                <TransformComponent
                  wrapperStyle={{ width: '100vw', height: '100vh' }}
                  contentStyle={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img
                    src={fileUrls[previewFile.fileId] || ''}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          ) : (
            <div
              className="bg-white rounded-lg p-6 text-center mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText size={48} className="text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-700 break-all">{previewFile.name}</p>
              <p className="text-xs text-gray-400 mt-1">미리보기는 지원하지 않습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
