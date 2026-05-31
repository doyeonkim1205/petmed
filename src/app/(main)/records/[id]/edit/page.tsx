'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Paperclip, Image as ImageIcon, FileText, Download, Trash2, Stethoscope, Pill, Bell, BellOff, Utensils, Footprints, CircleDot, Droplet, Smile, MoreHorizontal, PawPrint } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { ColorPicker } from '@/components/records/ColorPicker';
import { FileUploader } from '@/components/records/FileUploader';
import { supabase, Pet, HealthRecord, Medication, RecordFile, DailySubKind } from '@/lib/supabase';
import { uploadFile, saveFileRecord, deleteFile, checkStorageLimit } from '@/services/fileUpload';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { logActivity } from '@/lib/activityLog';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetSelectDropdown } from '@/components/records/PetSelectDropdown';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { Loader2 } from 'lucide-react';

const frequencyOptions = [
  { value: '1일 1회', times: 1 },
  { value: '1일 2회', times: 2 },
  { value: '1일 3회', times: 3 },
];

const defaultAlarmTimes: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '21:00'],
};

// 15분 단위 시간 옵션 생성 (00:00 ~ 23:45)
const alarmTimeOptions: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    alarmTimeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

// 일상 세부 종류 — add 페이지와 동일한 정의. 호환 위해 동일 순서 유지.
const dailySubKinds: { id: DailySubKind; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'meal',      label: '식사', icon: Utensils       },
  { id: 'hydration', label: '수분', icon: Droplet        },
  { id: 'walk',      label: '산책', icon: Footprints     },
  { id: 'poop',      label: '배변', icon: CircleDot      },
  { id: 'mood',      label: '기분', icon: Smile          },
  { id: 'other',     label: '기타', icon: MoreHorizontal },
];

// v12: sub_kind 는 분류 태그용, 메모는 description 1개로 통합.

interface MedicationInput {
  id?: string;
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
  color: string;
  alarm_enabled: boolean;
  alarm_times: string[];
  isNew?: boolean;
}

export default function RecordEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
  const { getRecord, updateRecord } = useHealthRecords();
  const { addMedication, updateMedication: updateMed, deleteMedication, getMedicationsByRecordId } = useMedications();
  const medEndRef = useRef<HTMLDivElement>(null);
  const fileEndRef = useRef<HTMLDivElement>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [symptomTime, setSymptomTime] = useState('');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const [recordColor, setRecordColor] = useState('#3B82F6');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentColor, setNextAppointmentColor] = useState('#8B5CF6');
  const [recordType, setRecordType] = useState('');
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [deletedMedIds, setDeletedMedIds] = useState<string[]>([]);
  // v12: 선택한 sub_kind 목록만 추적 (멀티 선택, 중복 X). 메모는 description state 활용.
  const [selectedSubKinds, setSelectedSubKinds] = useState<DailySubKind[]>([]);
  const [dischargeDate, setDischargeDate] = useState('');
  const [existingFiles, setExistingFiles] = useState<RecordFile[]>([]);
  const [deletedFileIds, setDeletedFileIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isPWA, setIsPWA] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);
  // 토글 ON 시 subscribe 진행 중 표시 (-1 = 없음)
  const [subscribingIdx, setSubscribingIdx] = useState<number>(-1);

  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user]);

  const loadData = async () => {
    try {
      const [record, petData] = await Promise.all([
        getRecord(id),
        supabase.from('pets').select('*').eq('user_id', user!.id),
      ]);

      setPets(petData.data || []);
      setPetId(record.pet_id);
      setTitle(record.title);
      setDescription(record.description || '');
      setHospitalName(record.hospital_name || '');
      setVisitDate(record.visit_date.split('T')[0]);
      setCost(record.cost ? String(record.cost) : '');
      setWeight(record.weight ? String(record.weight) : '');
      setRecordColor(record.color || '#3B82F6');
      setRecordType(record.record_type);
      setDischargeDate(record.discharge_date ? record.discharge_date.split('T')[0] : '');
      setNextAppointmentDate(record.next_appointment_date ? record.next_appointment_date.split('T')[0] : '');
      setNextAppointmentColor(record.next_appointment_color || '#8B5CF6');
      setSymptomTime(record.symptom_time || '');

      if (record.medications) {
        setMedications(
          record.medications.map((m: any) => {
            const opt = frequencyOptions.find(f => f.value === m.frequency);
            const times = m.alarm_times || (opt ? defaultAlarmTimes[opt.times] : ['09:00']);
            return {
              id: m.id,
              name: m.name,
              dosage: m.dosage || '',
              start_date: m.start_date,
              end_date: m.end_date || '',
              frequency: m.frequency,
              color: m.color || '#EC4899',
              alarm_enabled: m.alarm_enabled !== false,
              alarm_times: times,
            };
          })
        );
      }

      if (record.record_files) {
        setExistingFiles(record.record_files);
      }

      // v12: sub_entries 에서 sub_kind 만 복원 (중복 제거). 메모는 description 으로 통합 사용.
      // 기존 데이터 호환: description 비어있고 sub_entries[i].memo 가 있으면 합쳐서 description 으로.
      if (record.record_type === 'daily' && record.sub_entries) {
        const kinds = Array.from(new Set(record.sub_entries.map((e) => e.sub_kind)));
        setSelectedSubKinds(kinds);
        if (!record.description) {
          const legacyMemos = record.sub_entries.map((e) => e.memo).filter(Boolean).join('\n');
          if (legacyMemos) setDescription(legacyMemos);
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'records', action: 'load-for-edit' },
        extra: { recordId: id, userId: user?.id },
      });
      console.error('Error loading record:', error);
      router.push('/records');
    } finally {
      setLoading(false);
    }
  };

  // ── 변경 감지 + 이탈 방어 ──

  // 브라우저 닫기/새로고침 방어
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 하드웨어 뒤로가기 버튼 방어 (Android TWA / 모바일 브라우저)
  // isDirty 되면 가짜 히스토리 항목 push → popstate 로 가로채기
  //
  // ⚠️ 빠른 연속 back press race 방어 (Chrome 네이티브 다이얼로그 추가 노출 버그):
  //   이전 코드는 popstate handler 안에서 setTimeout(50ms) 후에 fake state 를
  //   push 했음. 안드로이드 TWA 에서 50ms 안에 두 번째 back 이 들어오면 그 사이에
  //   /edit 페이지가 history 에서 unwind 됨 → beforeunload 발사 → Chrome 네이티브
  //   다이얼로그가 우리 ConfirmModal 위에 겹쳐 떴음.
  //   → 해결: popstate 즉시 (sync) fake state 다시 push. iOS peek 검사 제거.
  //   iOS 스와이프 peek-cancel 시 모달이 살짝 뜰 수 있지만 [계속 수정] 한 번 누르면
  //   되고, Android 의 다이얼로그 중복 버그가 더 큰 문제.
  const guardPushedRef = useRef(false);
  useEffect(() => {
    if (!isDirty) return;
    if (!guardPushedRef.current) {
      window.history.pushState({ editGuard: true }, '');
      guardPushedRef.current = true;
    }
    const handler = () => {
      // sync 즉시 push — 빠른 연속 back 으로 /edit 페이지가 history 에서 빠지는 race 차단
      window.history.pushState({ editGuard: true }, '');
      if (isDirty && !saving && window.location.pathname.includes('/edit')) {
        setShowExitConfirm(true);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty, saving]);

  const handleBack = () => {
    if (saving) return;
    if (isDirty) setShowExitConfirm(true);
    else router.back();
  };

  const addMedicationRow = () => {
    // add 페이지와 일관성 유지: 새 약 행은 항상 alarm_enabled=false 로 시작.
    // 사용자가 직접 토글해야만 알림 ON 으로 설정됨.
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', color: '#EC4899', alarm_enabled: false, alarm_times: ['09:00'], isNew: true },
    ]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
  };

  const updateMedicationField = (index: number, field: keyof MedicationInput, value: string) => {
    setIsDirty(true);
    setMedications(medications.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const updateMedFrequency = (index: number, freq: string) => {
    const opt = frequencyOptions.find(f => f.value === freq);
    const times = opt ? defaultAlarmTimes[opt.times] : ['09:00'];
    setMedications(medications.map((m, i) => (i === index ? { ...m, frequency: freq, alarm_times: times } : m)));
  };

  const updateMedAlarmTime = (medIndex: number, timeIndex: number, value: string) => {
    setMedications(medications.map((m, i) => {
      if (i !== medIndex) return m;
      const newTimes = [...m.alarm_times];
      newTimes[timeIndex] = value;
      return { ...m, alarm_times: newTimes };
    }));
  };

  const toggleMedAlarm = async (index: number) => {
    const turningOn = !medications[index].alarm_enabled;
    setMedications(medications.map((m, i) => (i === index ? { ...m, alarm_enabled: turningOn } : m)));

    // ON 으로 토글 + 권한 granted 면 user-gesture 콜스택 안에서 즉시 subscribe
    // (iOS Safari 의 user-gesture 요구 만족). 멱등 — 이미 구독 있으면 no-op.
    if (
      turningOn &&
      canUseAlarm &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      user
    ) {
      setSubscribingIdx(index);
      try {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'edit-toggle-subscribe' },
            extra: { reason: result.reason },
          });
        }
      } finally {
        setSubscribingIdx(-1);
      }
    }
  };

  const removeMedication = (index: number) => {
    const med = medications[index];
    if (med.id) setDeletedMedIds([...deletedMedIds, med.id]);
    setMedications(medications.filter((_, i) => i !== index));
  };

  const removeExistingFile = (fileId: string) => {
    setDeletedFileIds([...deletedFileIds, fileId]);
    setExistingFiles(existingFiles.filter((f) => f.id !== fileId));
  };

  const maxAttachments = getPlanConfig(getEffectivePlan(profile?.plan)).attachmentsPerRecord;
  const activeFileCount = existingFiles.length + newFiles.length;
  const maxNewFiles = maxAttachments - existingFiles.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (recordType === 'daily') {
      if (selectedSubKinds.length === 0) {
        showError('세부 종류를 1개 이상 선택해주세요.'); return;
      }
      if (!description.trim()) {
        showError('메모를 입력해주세요.'); return;
      }
    } else {
      const titleLabel = recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '진료 사유';
      if (!title.trim()) { showError(`${titleLabel}를 입력해주세요.`); return; }
      if (dischargeDate && dischargeDate < visitDate) {
        showError('퇴원일은 입원일 이후여야 합니다.'); return;
      }
      if (nextAppointmentDate && nextAppointmentDate < visitDate) {
        showError('다음 예약일은 ' + (recordType === 'hospitalization' ? '입원일' : '진료일') + ' 이후여야 합니다.'); return;
      }
      const emptyNameMed = medications.find(m => !m.name.trim());
      if (emptyNameMed) {
        showError('약 이름을 입력해주세요.'); return;
      }
      const noEndMed = medications.find(m => m.name.trim() && !m.end_date);
      if (noEndMed) {
        showError(`투약 종료일을 선택해주세요. (${noEndMed.name})`); return;
      }
      const badMed = medications.find(m => m.end_date && m.end_date < m.start_date);
      if (badMed) {
        showError(`투약 종료일은 시작일 이후여야 합니다. (${badMed.name})`); return;
      }
    }

    setSaving(true);
    setError('');

    try {
      if (newFiles.length > 0) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const storage = await checkStorageLimit(token);
          if (!storage.canUpload) {
            showError(
              getEffectivePlan(profile?.plan) === 'plus'
                ? `저장 공간이 부족해요(${storage.limitMB}MB) 추가 용량이 필요하시면 문의해 주세요`
                : `저장 공간이 부족해요(${storage.limitMB}MB) Plus로 업그레이드하여 용량을 늘려보세요!`,
            );
            setSaving(false);
            return;
          }
        }
      }

      if (recordType === 'daily') {
        // v12: sub_entries 는 sub_kind 만, 메모는 description 으로 통합 저장.
        const subEntries = selectedSubKinds.map((k) => ({ sub_kind: k }));
        await updateRecord(id, {
          sub_entries: subEntries,
          description: description.trim(),
        } as any);
      } else {
        await updateRecord(id, {
          pet_id: petId,
          title: title.trim(),
          description: description.trim() || undefined,
          hospital_name: hospitalName.trim() || undefined,
          visit_date: visitDate,
          cost: cost ? Math.min(Math.max(0, Math.round(Number(cost))), 10000000) : undefined,
          color: recordColor,
          discharge_date: dischargeDate || null,
          next_appointment_date: nextAppointmentDate || null,
          next_appointment_color: nextAppointmentDate ? nextAppointmentColor : null,
          symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : null,
          weight: weight ? Number(weight) : null,
        } as any);
      }

      // Delete removed files
      for (const fileId of deletedFileIds) {
        try {
          const file = (await supabase.from('record_files').select('file_path').eq('id', fileId).eq('user_id', user.id).single()).data;
          if (file) await deleteFile(file.file_path);
          await supabase.from('record_files').delete().eq('id', fileId).eq('user_id', user.id);
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: 'records', action: 'file-delete' },
            extra: { recordId: id, userId: user?.id, fileId },
          });
          console.error('File delete error:', err);
        }
      }

      // Upload new files
      for (const file of newFiles) {
        try {
          const { path } = await uploadFile(file, user.id, id);
          await saveFileRecord({
            record_id: id,
            user_id: user.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
          });
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: 'records', action: 'file-upload-edit' },
            extra: { recordId: id, userId: user?.id, fileName: file.name },
          });
          console.error('File upload error:', err);
        }
      }

      // Delete removed medications
      for (const medId of deletedMedIds) {
        await deleteMedication(medId);
      }

      // Update existing / add new medications
      for (const med of medications) {
        if (med.isNew && med.name.trim()) {
          await addMedication({
            record_id: id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || undefined,
            frequency: med.frequency,
            color: med.color,
            alarm_enabled: med.alarm_enabled,
            alarm_times: med.alarm_times,
          });
        } else if (med.id && med.name.trim()) {
          await updateMed(med.id, {
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || null,
            frequency: med.frequency,
            color: med.color,
            alarm_enabled: med.alarm_enabled,
            alarm_times: med.alarm_times,
          });
        }
      }

      logActivity(user.id, 'record.update', { resourceType: 'record', resourceId: id });

      // 저장 시점 silent subscribe — 토글 시점에 이미 처리됐을 가능성 높지만 백업.
      // 헬퍼는 멱등이라 반복 호출 안전. iOS Safari 는 user-gesture 만료로
      // 실패 가능 → 토글 시점 처리가 우선.
      const anyAlarmOn = medications.some(m => m.name.trim() && m.alarm_enabled);
      if (canUseAlarm && anyAlarmOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`save-silent-subscribe failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'save-silent-subscribe' },
            extra: { reason: result.reason },
          });
        }
      }

      // 저장 성공 → dirty 해제 (popstate guard 가 가로채지 않도록)
      const hadGuard = guardPushedRef.current;
      setIsDirty(false);
      guardPushedRef.current = false;
      // edit 엔트리만 pop 해서 기존 detail 로 복귀
      if (typeof window !== 'undefined' && window.history.length > 1) {
        // 가짜 히스토리 항목이 있으면 2단계 back, 아니면 1단계
        window.history.go(hadGuard ? -2 : -1);
      } else {
        router.replace(`/records/${id}`);
      }
      // detail 페이지의 서버 상태 revalidate (Router Cache 무효화 → useEffect 재실행 시 최신 데이터 fetch)
      router.refresh();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'records', action: 'update' },
        extra: { recordId: id, userId: user?.id },
      });
      console.error('Error updating record:', err);
      setError('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10">
        <button onClick={handleBack} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 수정</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="flex-1 px-4 pb-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {/* ── 섹션 헤더 — 일상은 "일상 기록", 그 외는 "기본 정보" ── */}
        <div className="flex items-center gap-2 py-2 bg-blue-50 -mx-4 px-4">
          {recordType === 'daily' ? (
            <PawPrint size={16} className="text-gray-400" />
          ) : (
            <Stethoscope size={16} className="text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-800">
            {recordType === 'daily' ? '일상 기록' : '기본 정보'}
          </h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">반려동물</label>
          {pets.length > 0 ? (
            <PetSelectDropdown pets={pets} value={petId} onChange={setPetId} />
          ) : (
            <p className="text-xs text-gray-400">등록된 반려동물이 없습니다.</p>
          )}
        </div>

        {/* 일상 — 세부 종류 멀티 선택 (분류 태그) + 통합 메모 1개 (일기 형식, 수정용) */}
        {recordType === 'daily' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              세부 종류 <span className="text-gray-400 font-normal text-xs">(여러 개 선택 가능)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {dailySubKinds.map((sk) => {
                const Icon = sk.icon;
                const selected = selectedSubKinds.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubKinds((prev) => prev.includes(sk.id) ? prev.filter((k) => k !== sk.id) : [...prev, sk.id]);
                      setIsDirty(true);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium border-2 transition-colors ${
                      selected ? 'bg-white text-blue-600 border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={14} />
                    {sk.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium block mb-2">메모</label>
              <textarea
                placeholder="오늘 하루를 기록해보세요"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                maxLength={700}
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white min-h-[140px] resize-none"
              />
            </div>
          </div>
        )}

        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '진료 사유'}
          </label>
          <input
            type="search"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            autoComplete="off"
            enterKeyHint="next"
            name="record-title"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        )}

        {/* Weight (증상 기록: 증상명 아래) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              체중 (kg) <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="예: 3.5"
              autoComplete="off"
              maxLength={6}
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '발생일' : recordType === 'hospitalization' ? '입원일' : '진료일'}
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {(recordType === 'visit' || recordType === 'hospitalization') && (
            <ColorPicker label="캘린더 표시 색상" value={recordColor} onChange={setRecordColor}  />
          )}
        </div>
        )}

        {/* Symptom Time (optional, symptom only) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              발생 시간 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <TimePicker value={symptomTime} onChange={setSymptomTime} />
          </div>
        )}

        {/* Discharge Date (입퇴원: 입원일 바로 아래) */}
        {recordType === 'hospitalization' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              퇴원일 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="date"
              value={dischargeDate}
              onChange={(e) => setDischargeDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-400">아직 입원 중이면 비워두세요</p>
          </div>
        )}

        {/* Description (증상만 기본정보에) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              설명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={700}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
            />
          </div>
        )}

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <>
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">진료 정보</h3>
            </div>

            {/* Description (진료/입퇴원 → 진료정보에) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                설명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
              />
            </div>

            {/* Weight (진료/입퇴원: 설명 아래) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                체중 (kg) <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="예: 3.5"
                value={weight}
                onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                병원명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="search"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                maxLength={30}
                autoComplete="off"
                enterKeyHint="next"
                name="hospital-name"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                비용 (원) <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
                autoComplete="off"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Next Appointment Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                다음 예약일 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="date"
                value={nextAppointmentDate}
                onChange={(e) => setNextAppointmentDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {nextAppointmentDate && (
                <div className="ml-3 pl-3 border-l-2 border-purple-200">
                  <ColorPicker label="예약일 색상" value={nextAppointmentColor} onChange={setNextAppointmentColor} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 투약 정보 섹션 ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Pill size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">투약 정보</h3>
              <button
                type="button"
                onClick={addMedicationRow}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium ml-auto"
              >
                <Plus size={16} /> 약 추가
              </button>
            </div>
            {medications.map((med, i) => (
              <div key={med.id || i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  type="search"
                  placeholder="약 이름"
                  value={med.name}
                  onChange={(e) => updateMedicationField(i, 'name', e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-name-${i}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                <input
                  type="search"
                  placeholder="용량 (예: 1정)"
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-dosage-${i}`}
                  value={med.dosage}
                  onChange={(e) => updateMedicationField(i, 'dosage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                {/* Frequency selector */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">투약 빈도</label>
                  <div className="flex gap-1.5">
                    {frequencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateMedFrequency(i, opt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          med.frequency === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-500'
                        }`}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">시작일</label>
                    <input
                      type="date"
                      value={med.start_date}
                      onChange={(e) => updateMedicationField(i, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">종료일</label>
                    <input
                      type="date"
                      value={med.end_date}
                      onChange={(e) => updateMedicationField(i, 'end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                </div>
                <ColorPicker
                  label="캘린더 색상"
                  value={med.color}
                  onChange={(c) => updateMedicationField(i, 'color', c)}
                />
                {/* 투약 알림 */}
                <div className="border-t border-gray-200 pt-2">
                  <button
                    type="button"
                    onClick={() => canUseAlarm ? toggleMedAlarm(i) : setShowAlarmUpgrade(true)}
                    disabled={subscribingIdx === i}
                    className={`flex items-center gap-2 w-full py-2 px-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                      med.alarm_enabled ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  >
                    {subscribingIdx === i ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : med.alarm_enabled ? (
                      <Bell size={14} />
                    ) : (
                      <BellOff size={14} />
                    )}
                    {subscribingIdx === i ? '알림 켜는 중...' : `투약 알림 ${med.alarm_enabled ? 'ON' : 'OFF'}`}
                  </button>
                  {canUseAlarm && med.alarm_enabled && (
                    <div className="space-y-1.5 mt-1">
                      {med.alarm_times.map((time, ti) => (
                        <div key={ti} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12">{ti + 1}회차</span>
                          <TimePicker
                            value={time}
                            onChange={(v) => updateMedAlarmTime(i, ti, v)}
                            minuteStep={15}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => removeMedication(i)}
                    className="flex items-center gap-1 py-1.5 px-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                    삭제
                  </button>
                </div>
              </div>
            ))}
            <div ref={medEndRef} />
          </div>
        )}

        {/* ── 첨부파일 섹션 (일상 제외) ── */}
        {recordType !== 'daily' && (<>
        <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
          <Paperclip size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">첨부파일</h3>
        </div>

        <div className="space-y-3">
          {/* Existing files */}
          {existingFiles.length > 0 && (
            <div className="space-y-2">
              {existingFiles.map((file) => {
                const isImage = file.file_type?.startsWith('image/');
                const FileIcon = isImage ? ImageIcon : FileText;
                const { data: urlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path);
                const { data: dlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path, { download: file.file_name });

                return (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {isImage ? (
                      <img
                        src={urlData.publicUrl}
                        alt={file.file_name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <FileIcon size={20} className="text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400">{(file.file_size / 1024).toFixed(0)}KB</p>
                    </div>
                    <a
                      href={dlData.publicUrl}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="다운로드"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(file.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* New file upload — 한도 도달 시 FileUploader 내부에서 안내 표시 */}
          <FileUploader
            files={newFiles}
            onFilesChange={(files) => {
              const added = files.length > newFiles.length;
              setNewFiles(files);
              if (added) {
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
              }
            }}
            maxFiles={Math.max(maxNewFiles, 0)}
            placeholder={recordType === 'symptom' ? '증상 관련 사진이나 파일을 첨부하세요' : '진료 서류를 첨부하세요'}
          />
          <div ref={fileEndRef} />
        </div>
        </>)}
      </form>

      {/* Bottom Save Button */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 z-10">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 알림 기능 업그레이드 안내 팝업 */}
      {showAlarmUpgrade && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-gray-800">알림 기능</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {!isPWA
                ? '앱을 설치하고 유료 플랜으로 업그레이드하면 투약 알림을 받을 수 있습니다.'
                : '유료 플랜으로 업그레이드하면 투약 알림을 받을 수 있습니다.'}
            </p>
            <p className="text-xs text-gray-400 mb-4">투약 시간, 예약일, 퇴원일에 푸시 알림을 보내드립니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAlarmUpgrade(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                요금제 보기
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title="저장하지 않고 나갈까요?"
        message="저장되지 않은 변경사항이 있습니다."
        confirmLabel="나가기"
        cancelLabel="계속 수정"
        variant="danger"
        onConfirm={() => {
          setShowExitConfirm(false);
          setIsDirty(false);
          guardPushedRef.current = false;
          // 가짜 히스토리 항목 + 실제 뒤로가기 → 2단계 back
          window.history.go(-2);
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
