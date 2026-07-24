'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, X, Paperclip, Image as ImageIcon, FileText, Download, Trash2, Stethoscope, Pill, Bell, BellOff, PawPrint } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMarketRegion } from '@/hooks/useMarketRegion';
import { currencyForRegion, currencyDecimals, roundToCurrency, sanitizeAmountInput, formatAmountInput, weightUnit, displayWeightToKg, kgToInputStr } from '@/lib/region';
import { useMedications } from '@/hooks/useMedications';
import { ColorPicker } from '@/components/records/ColorPicker';
import { FileUploader } from '@/components/records/FileUploader';
import { PlusUpgradeNotice } from '@/components/PlusUpgradeNotice';
import { supabase, Pet, HealthRecord, Medication, RecordFile } from '@/lib/supabase';
import { uploadFile, saveFileRecord, deleteFile, checkStorageLimit } from '@/services/fileUpload';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { logActivity } from '@/lib/activityLog';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetSelectDropdown } from '@/components/records/PetSelectDropdown';
import { SafeImage } from '@/components/ui/SafeImage';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { NumberPad } from '@/components/ui/NumberPad';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { isInstalledApp, isNativeApp } from '@/lib/platform';
import { Loader2 } from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { type RecordDraft } from '@/lib/recordDraft';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';

// value 는 DB 저장값(한국어 고정). 표시는 labelKey 로 분리 (add 와 동일).
const frequencyOptions = [
  { value: '1일 1회', times: 1, labelKey: 'onceDaily' },
  { value: '1일 2회', times: 2, labelKey: 'twiceDaily' },
  { value: '1일 3회', times: 3, labelKey: 'thriceDaily' },
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
  const t = useTranslations();
  const router = useRouter();
  const { user, profile } = useAuth();
  const region = useMarketRegion();
  const curr = currencyForRegion(region);   // 입력 통화 (KRW=정수 / USD=소수 2자리)
  const { getRecord, updateRecord } = useHealthRecords();
  const { addMedication, updateMedication: updateMed, deleteMedication, getMedicationsByRecordId } = useMedications();
  const medEndRef = useRef<HTMLDivElement>(null);
  const fileEndRef = useRef<HTMLDivElement>(null);

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
  const [dischargeDate, setDischargeDate] = useState('');
  // record updated_at — draft stale 판정용. record 로드 후 set.
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  // record 원본 (RecordDraft 형태) — useDraftPersistence 의 비교 기준.
  const [recordOrigin, setRecordOrigin] = useState<RecordDraft | null>(null);
  const [existingFiles, setExistingFiles] = useState<RecordFile[]>([]);
  // 파일 ID → display 용 signedUrl. record 로드 시 일괄 발급, SafeImage 의 onError 재발급 시 동기화.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [deletedFileIds, setDeletedFileIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 저장 용량 초과 — 무료 사용자에겐 Plus 업셀 카드로 안내 (유료는 일반 에러). 값=한도 MB.
  const [storageFullMb, setStorageFullMb] = useState<number | null>(null);
  const [isPWA, setIsPWA] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);
  const [subscribingIdx, setSubscribingIdx] = useState<number>(-1);

  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false);

  // Chrome autofill 차단 readonly trick — focus 전 readOnly 라 Chrome 휴리스틱이 input 분류 안 함.
  const [costFocused, setCostFocused] = useState(false);
  const [weightFocused, setWeightFocused] = useState(false);
  // 터치 기기에선 OS 키보드 대신 내장 숫자 패드 (크롬 autofill 칩 차단)
  const [isTouch, setIsTouch] = useState(false);
  const [showWeightPad, setShowWeightPad] = useState(false);
  const [showCostPad, setShowCostPad] = useState(false);
  useEffect(() => {
    setIsTouch(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);


  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    setIsPWA(isInstalledApp());
  }, []);

  // 최근 병원명 DB 에서 로드 — add 페이지와 동일 패턴.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/recent-hospitals');
        if (res.ok) {
          const names: string[] = await res.json();
          setHospitalSuggestions(names);
        }
      } catch {}
    })();
  }, [user?.id]);

  // ⚠️ dep 에 `user` 객체 쓰지 말 것 — Supabase auth 가 visibility 변경 / 토큰
  // refresh 시 setUser(new object) 를 호출해 reference 가 바뀌면 effect 가 다시 fire,
  // loadData() 가 record 값으로 state 를 reset → 사용자 입력 손실.
  // user?.id (primitive) 로 비교해야 안전.
  useEffect(() => {
    if (id && user?.id) loadData();
  }, [id, user?.id]);

  // 자동 복원 콜백 — hook 이 draft 발견 시 호출. 모든 setter 한 곳에 모음.
  const applyDraftValues = (d: RecordDraft) => {
    if (d.recordType) setRecordType(d.recordType);
    if (d.petId) setPetId(d.petId);
    if (d.title !== undefined) setTitle(d.title);
    if (d.description !== undefined) setDescription(d.description);
    if (d.hospitalName !== undefined) setHospitalName(d.hospitalName);
    if (d.cost !== undefined) setCost(d.cost);
    if (d.weight !== undefined) setWeight(d.weight);
    if (d.symptomTime !== undefined) setSymptomTime(d.symptomTime);
    if (d.visitDate) setVisitDate(d.visitDate);
    if (d.dischargeDate !== undefined) setDischargeDate(d.dischargeDate);
    if (d.nextAppointmentDate !== undefined) setNextAppointmentDate(d.nextAppointmentDate);
    if (d.recordColor) setRecordColor(d.recordColor);
    if (d.nextAppointmentColor) setNextAppointmentColor(d.nextAppointmentColor);
  };

  // hook 에 전달할 현재 form state — 매 render 마다 새 객체 (hook 안에서 ref 로 mirror).
  const formState: RecordDraft = {
    recordType: recordType as RecordDraft['recordType'], title, description, hospitalName,
    cost, weight, symptomTime, visitDate, dischargeDate, nextAppointmentDate,
    recordColor, nextAppointmentColor, petId,
  };

  const {
    isDirty,
    setIsDirty,
    pendingDraft,
    applyDraft,
    discardDraft,
    clearDraftAndSession,
  } = useDraftPersistence({
    variant: 'edit',
    userId: user?.id,
    recordId: id,
    ready: !!recordUpdatedAt,  // record 로드 완료 후 활성
    formState,
    recordOrigin,
    serverUpdatedAt: recordUpdatedAt,
    onApplyDraft: applyDraftValues,
  });

  const loadData = async () => {
    try {
      const [record, petData] = await Promise.all([
        getRecord(id),
        supabase.from('pets').select('*').eq('user_id', user!.id),
      ]);

      setPets(sortPetsWithDefault(petData.data || [], readDefaultPetId()));
      setPetId(record.pet_id);
      setTitle(record.title);
      setDescription(record.description || '');
      setHospitalName(record.hospital_name || '');
      setVisitDate(record.visit_date.split('T')[0]);
      setCost(record.cost ? String(record.cost) : '');
      setWeight(kgToInputStr(record.weight, region));
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
        // 첨부 파일별 1시간 signedUrl 일괄 발급 — bucket private 전환 후엔 이게 유일한 접근 경로.
        const entries = await Promise.all(
          record.record_files.map(async (f: RecordFile) => {
            try {
              const { data } = await supabase.storage.from('medical-files').createSignedUrl(f.file_path, 3600);
              return [f.id, data?.signedUrl ?? ''] as const;
            } catch {
              return [f.id, ''] as const;
            }
          })
        );
        setFileUrls(Object.fromEntries(entries));
      }

      // 세부 종류는 제거됨 — 기존 일상 기록 호환: description 비어있고 sub_entries[i].memo 가
      // 있으면 합쳐서 description 으로 복원 (옛 메모 손실 방지).
      if (record.record_type === 'daily' && record.sub_entries && !record.description) {
        const legacyMemos = record.sub_entries.map((e) => e.memo).filter(Boolean).join('\n');
        if (legacyMemos) setDescription(legacyMemos);
      }

      // record 원본 스냅샷 — useDraftPersistence 의 state vs origin 비교 기준.
      // legacy memo 합본을 description 원본으로 사용 (false-positive dirty 방지).
      const originalDescription = record.description
        || (record.record_type === 'daily' && record.sub_entries
            ? record.sub_entries.map((e) => e.memo).filter(Boolean).join('\n')
            : '');
      setRecordOrigin({
        recordType: record.record_type,
        title: record.title,
        description: originalDescription,
        hospitalName: record.hospital_name || '',
        cost: record.cost ? String(record.cost) : '',
        weight: kgToInputStr(record.weight, region),
        symptomTime: record.symptom_time || '',
        visitDate: record.visit_date.split('T')[0],
        dischargeDate: record.discharge_date ? record.discharge_date.split('T')[0] : '',
        nextAppointmentDate: record.next_appointment_date ? record.next_appointment_date.split('T')[0] : '',
        recordColor: record.color || '#3B82F6',
        nextAppointmentColor: record.next_appointment_color || '#8B5CF6',
        petId: record.pet_id,
      });

      // recordUpdatedAt 은 가장 마지막에 set — useDraftPersistence 의 ready 트리거.
      // ready=true 가 되면 hook 이 draft 체크 + 자동 복원 또는 모달 표시 진행.
      setRecordUpdatedAt(record.updated_at ?? null);
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
  // beforeunload 가드 제거 — 브라우저 네이티브 "사이트를 새로고침하겠습니까?" 다이얼로그는
  // 디자인 커스텀 불가. draft 자동 저장이 데이터 보호하므로 불필요.
  // 새로고침/탭 닫기는 pagehide 가 draft 저장 → 다시 진입 시 복원.
  // 뒤로가기는 popstate guard + ConfirmModal (커스텀 UI) 로 처리.

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
      // 가드가 해제된 상태(저장/이탈 시 guardPushedRef=false 세팅 후 history.go 로 이동)면 재-push 금지.
      //   ← 이게 없으면 go(-2) 가 만든 popstate 를 이 핸들러가 받아 (이미 상세 URL 인 상태에서)
      //     history 를 다시 쌓아 "상세와 같은 유령 항목" 이 생김 → 상세에서 뒤로가기를 두 번
      //     눌러야 목록으로 나가지는 버그. guardPushedRef 는 ref 라 stale closure 안전.
      if (!guardPushedRef.current) return;
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
    setTimeout(() => medEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);
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
      (isNativeApp() || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) &&
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

  // 일상 기록은 '오늘을 담은 한 컷' — 사진 1장 고정 (플랜 무관). 그 외는 플랜별 첨부.
  const maxAttachments = recordType === 'daily'
    ? 1
    : getPlanConfig(getEffectivePlan(profile?.plan)).attachmentsPerRecord;
  const activeFileCount = existingFiles.length + newFiles.length;
  const maxNewFiles = maxAttachments - existingFiles.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setStorageFullMb(null);
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (recordType === 'daily') {
      // 제목 필수, 메모는 선택.
      if (!title.trim()) {
        showError(t('record.form.error.titleRequired')); return;
      }
    } else {
      const titleLabel = t(`record.form.titleLabel.${recordType}`);
      if (!title.trim()) { showError(t('record.form.error.fieldRequired', { field: titleLabel })); return; }
      if (dischargeDate && dischargeDate < visitDate) {
        showError(t('record.form.error.dischargeAfterAdmission')); return;
      }
      if (recordType === 'visit' && nextAppointmentDate && nextAppointmentDate < visitDate) {
        showError(t('record.form.error.appointmentAfterVisit')); return;
      }
      const emptyNameMed = medications.find(m => !m.name.trim());
      if (emptyNameMed) {
        showError(t('record.form.error.medNameRequired')); return;
      }
      const noEndMed = medications.find(m => m.name.trim() && !m.end_date);
      if (noEndMed) {
        showError(t('record.form.error.medEndRequired')); return;
      }
      const badMed = medications.find(m => m.end_date && m.end_date < m.start_date);
      if (badMed) {
        showError(t('record.form.error.medEndAfterStart')); return;
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
            if (getEffectivePlan(profile?.plan) === 'plus') {
              showError(t('record.form.error.storageFullApp', { mb: storage.limitMB }));
            } else {
              setError('');
              setStorageFullMb(storage.limitMB);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setSaving(false);
            return;
          }
        }
      }

      if (recordType === 'daily') {
        // 제목(선택, 비우면 fallback) + 메모(description) 저장.
        await updateRecord(id, {
          title: title.trim() || '일상 기록',
          sub_entries: [],
          description: description.trim(),
        } as any);
      } else {
        await updateRecord(id, {
          pet_id: petId,
          title: title.trim(),
          description: description.trim() || undefined,
          hospital_name: hospitalName.trim() || undefined,
          visit_date: visitDate,
          cost: cost ? Math.min(Math.max(0, roundToCurrency(Number(cost), curr)), 10000000) : undefined,
          color: recordColor,
          discharge_date: dischargeDate || null,
          // 다음 예약은 진료만 — 입퇴원 기록엔 저장 안 함(유형 전환/기존 상태 잔존 방지).
          next_appointment_date: recordType === 'visit' && nextAppointmentDate ? nextAppointmentDate : null,
          next_appointment_color: recordType === 'visit' && nextAppointmentDate ? nextAppointmentColor : null,
          symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : null,
          weight: weight ? displayWeightToKg(Number(weight), region) : null,
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
          // 첨부 실패는 Sentry 로만 보고 — add page 와 동일 정책.
          Sentry.captureException(err, {
            tags: { feature: 'records', action: 'file-upload-edit' },
            extra: { recordId: id, userId: user?.id, fileName: file.name, fileSize: file.size, fileType: file.type },
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
            pet_id: petId,
            kind: 'prescription',
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

      // 저장 성공 → draft + 세션 마커 정리, dirty 해제 (popstate guard 가 가로채지 않도록)
      clearDraftAndSession();
      // 홈 브리핑 캐시 무효화 — 수정된 record 가 홈 메트릭에 즉시 반영.
      if (user?.id) {
        const { invalidateHealthBriefing } = await import('@/lib/swrCache');
        invalidateHealthBriefing(user.id);
      }
      const hadGuard = guardPushedRef.current;
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
      setError(t('record.form.error.editFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen inMain />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-[calc(5rem_+_env(safe-area-inset-bottom))]">
      <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 bg-white z-10" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.75rem + env(safe-area-inset-top))' }}>
        <button onClick={handleBack} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">{t('record.form.editTitle')}</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pb-4 space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm break-keep break-words">{error}</div>
        )}
        {storageFullMb !== null && (
          <PlusUpgradeNotice
            message={t('record.form.error.storageFullFree', { mb: storageFullMb })}
          />
        )}

        {/* ── 섹션 헤더 — 일상은 "일상 기록", 그 외는 "기본 정보" ── */}
        <div className="flex items-center gap-2 py-2 bg-blue-50 -mx-4 px-4">
          {recordType === 'daily' ? (
            <PawPrint size={16} className="text-gray-400" />
          ) : (
            <Stethoscope size={16} className="text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-800">
            {recordType === 'daily' ? t('record.type.daily') : t('record.section.basicInfo')}
          </h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('common.pet')}</label>
          {pets.length > 0 ? (
            <PetSelectDropdown pets={pets} value={petId} onChange={setPetId} />
          ) : (
            <p className="text-xs text-gray-400">{t('record.form.noPets')}</p>
          )}
        </div>

        {/* 일상 — 제목(선택) + 통합 메모 1개 (일기 형식, 수정용) */}
        {recordType === 'daily' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('record.form.title')}</label>
              <input
                type="search"
                placeholder={t('record.form.dailyTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                autoComplete="off"
                enterKeyHint="next"
                name="record-title"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">{t('record.form.memo')} <span className="text-gray-400 font-normal">{t('common.optional')}</span></label>
              <textarea
                name="description"
                placeholder={t('record.form.dailyMemoPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
                maxLength={1000}
                autoComplete="off"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white min-h-[220px] resize-none"
              />
            </div>
          </>
        )}

        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t(`record.form.titleLabel.${recordType}`)}
          </label>
          <input
            type="search"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            autoComplete="off"
            enterKeyHint="next"
            name="record-title"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        )}

        {/* Weight (증상 기록: 증상명 아래) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('record.field.weight')} ({weightUnit(region)}) <span className="text-gray-400 font-normal">{t('common.optional')}</span>
            </label>
            <input
              type="text"
              inputMode={isTouch ? 'none' : 'decimal'}
              placeholder={t('record.form.weightPlaceholder')}
              autoComplete="off"
              maxLength={6}
              name="pet-weight-kg"
              readOnly={isTouch}
              onClick={() => { if (isTouch) setShowWeightPad(true); }}
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t(`record.form.dateLabel.${recordType}`)}
          </label>
          <DatePicker
            value={visitDate}
            onChange={setVisitDate}
            name="visit-date"
          />
          {recordType === 'visit' && (
            <ColorPicker label={t('record.form.calendarColor')} value={recordColor} onChange={setRecordColor}  />
          )}
        </div>
        )}

        {/* Symptom Time (optional, symptom only) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('record.form.onsetTime')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
            </label>
            <TimePicker value={symptomTime} onChange={setSymptomTime} />
          </div>
        )}

        {/* Discharge Date (입퇴원: 입원일 바로 아래) */}
        {recordType === 'hospitalization' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('record.field.dischargeDate')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
            </label>
            <DatePicker
              value={dischargeDate}
              onChange={setDischargeDate}
              name="discharge-date"
              min={visitDate}
            />
            <p className="text-xs text-gray-400">{t('record.form.dischargeHint')}</p>
            <ColorPicker label={t('record.form.calendarColor')} value={recordColor} onChange={setRecordColor}  />
          </div>
        )}

        {/* Description (증상만 기본정보에) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('record.form.description')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
            </label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
              maxLength={700}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[140px] resize-none"
            />
          </div>
        )}

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <>
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">{recordType === 'hospitalization' ? t('record.section.hospitalizationDetail') : t('record.section.visitDetail')}</h3>
            </div>

            {/* Description (진료/입퇴원 → 진료정보에) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.form.description')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <textarea
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
                maxLength={700}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[140px] resize-none"
              />
            </div>

            {/* Weight (진료/입퇴원: 설명 아래) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.field.weight')} ({weightUnit(region)}) <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <input
                type="text"
                inputMode={isTouch ? 'none' : 'decimal'}
                placeholder={t('record.form.weightPlaceholder')}
                value={weight}
                onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
                readOnly={isTouch ? true : !weightFocused}
                onClick={() => { if (isTouch) setShowWeightPad(true); }}
                onFocus={() => setWeightFocused(true)}
                onBlur={() => setWeightFocused(false)}
                autoComplete="one-time-code"
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                name="record-weight-value"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.form.hospitalName')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <div className="relative">
                <input
                  type="search"
                  placeholder={t('record.form.hospitalNamePlaceholder')}
                  value={hospitalName}
                  onChange={(e) => { setHospitalName(e.target.value); setShowHospitalSuggestions(true); }}
                  onFocus={() => setShowHospitalSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowHospitalSuggestions(false), 150)}
                  maxLength={30}
                  autoComplete="off"
                  enterKeyHint="next"
                  name="hospital-name"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                {showHospitalSuggestions && hospitalSuggestions.filter(h => h.toLowerCase().includes(hospitalName.toLowerCase()) && h !== hospitalName).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {hospitalSuggestions.filter(h => h.toLowerCase().includes(hospitalName.toLowerCase()) && h !== hospitalName).map((name) => (
                      <div key={name} className="flex items-center hover:bg-blue-50 transition-colors">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setHospitalName(name); setShowHospitalSuggestions(false); setIsDirty(true); }}
                          className="flex-1 text-left px-4 py-2.5 text-sm text-gray-700"
                        >
                          {name}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={async () => {
                            setHospitalSuggestions(prev => prev.filter(h => h !== name));
                            try {
                              const { authFetch } = await import('@/lib/authFetch');
                              await authFetch('/api/recent-hospitals', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name }),
                              });
                            } catch {}
                          }}
                          className="px-3 py-2.5 text-gray-300 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.form.costWon')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <input
                type="text"
                inputMode={isTouch ? 'none' : 'numeric'}
                pattern="[0-9]*"
                value={formatAmountInput(cost, curr)}
                onChange={(e) => setCost(sanitizeAmountInput(e.target.value, curr, 8))}
                readOnly={isTouch ? true : !costFocused}
                onClick={() => { if (isTouch) setShowCostPad(true); }}
                onFocus={() => setCostFocused(true)}
                onBlur={() => setCostFocused(false)}
                autoComplete="one-time-code"
                data-form-type="other"
                data-1p-ignore="true"
                data-lpignore="true"
                name="record-cost-amount"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Next Appointment Date — 진료만. 입퇴원은 입원~퇴원 타임라인이 핵심이라 제외. */}
            {recordType === 'visit' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.field.nextAppointment')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <DatePicker
                value={nextAppointmentDate}
                onChange={setNextAppointmentDate}
                name="next-appointment-date"
                min={visitDate}
              />
              {nextAppointmentDate && (
                <div className="ml-3 pl-3 border-l-2 border-purple-200">
                  <ColorPicker label={t('record.form.appointmentColor')} value={nextAppointmentColor} onChange={setNextAppointmentColor} />
                </div>
              )}
            </div>
            )}
          </>
        )}

        {/* ── 투약 정보 섹션 ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Pill size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">{t('record.section.medicationInfo')}</h3>
              <button
                type="button"
                onClick={addMedicationRow}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium ml-auto"
              >
                <Plus size={16} /> {t('record.form.addMed')}
              </button>
            </div>
            {medications.map((med, i) => (
              <div key={med.id || i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  type="search"
                  placeholder={t('record.form.medNamePlaceholder')}
                  value={med.name}
                  onChange={(e) => updateMedicationField(i, 'name', e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-name-${i}`}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                <input
                  type="search"
                  placeholder={t('record.form.dosagePlaceholder')}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-dosage-${i}`}
                  value={med.dosage}
                  onChange={(e) => updateMedicationField(i, 'dosage', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                {/* Frequency selector */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{t('record.form.frequency')}</label>
                  <div className="flex gap-1.5">
                    {frequencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateMedFrequency(i, opt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          med.frequency === opt.value
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'bg-white border border-gray-200 text-gray-500'
                        }`}
                      >
                        {t(`record.dose.${opt.labelKey}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">{t('record.form.startDate')}</label>
                    <DatePicker
                      value={med.start_date}
                      onChange={(v) => updateMedicationField(i, 'start_date', v)}
                      inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">{t('record.form.endDate')}</label>
                    <DatePicker
                      value={med.end_date}
                      onChange={(v) => updateMedicationField(i, 'end_date', v)}
                      min={med.start_date}
                      inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
                <ColorPicker
                  label={t('record.form.medCalendarColor')}
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
                    {subscribingIdx === i ? t('record.form.alarmTurningOn') : t('record.form.medAlarm', { state: med.alarm_enabled ? 'ON' : 'OFF' })}
                  </button>
                  {canUseAlarm && med.alarm_enabled && (
                    <div className="space-y-1.5 mt-1">
                      {med.alarm_times.map((time, ti) => (
                        <div key={ti} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12">{t('record.form.doseNth', { n: ti + 1 })}</span>
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
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
            <div ref={medEndRef} />
          </div>
        )}

        {/* ── 첨부 섹션 — 일상은 '오늘을 담은 한 컷' (1장), 그 외는 첨부파일 ── */}
        <>
        <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
          <Paperclip size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">
            {recordType === 'daily' ? t('record.detail.dailyPhoto') : t('record.form.attachments')}
          </h3>
        </div>

        <div className="space-y-3">
          {/* Existing files */}
          {existingFiles.length > 0 && (
            <div className="space-y-2">
              {existingFiles.map((file) => {
                const isImage = file.file_type?.startsWith('image/');
                const FileIcon = isImage ? ImageIcon : FileText;
                const fileUrl = fileUrls[file.id] || '';

                const refetch = async () => {
                  const { data } = await supabase.storage.from('medical-files').createSignedUrl(file.file_path, 3600);
                  if (!data) throw new Error('signed url failed');
                  setFileUrls((prev) => ({ ...prev, [file.id]: data.signedUrl }));
                  return data.signedUrl;
                };

                const handleDownload = async () => {
                  const { data } = await supabase.storage
                    .from('medical-files')
                    .createSignedUrl(file.file_path, 60, { download: file.file_name });
                  if (!data) return;
                  const a = document.createElement('a');
                  a.href = data.signedUrl;
                  a.download = file.file_name;
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                };

                return (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {isImage ? (
                      <SafeImage
                        src={fileUrl}
                        alt={file.file_name}
                        onRefetchUrl={refetch}
                        className="w-10 h-10 rounded flex-shrink-0"
                        imgClassName="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <FileIcon size={20} className="text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400">{(file.file_size / 1024).toFixed(0)}KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title={t('record.detail.download')}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(file.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      title={t('common.delete')}
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
                setTimeout(() => fileEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);
              }
            }}
            maxFiles={Math.max(maxNewFiles, 0)}
            placeholder={recordType === 'daily' ? t('record.form.dailyPhotoPlaceholder') : undefined}
            atLimitUpsell={recordType === 'daily' ? 'none' : (isPaidUser ? 'plus' : 'free')}
          />
          <div ref={fileEndRef} />
        </div>
        </>
        {/* 키보드 + fixed 저장 버튼 + Footer 영역(약 130px)에 마지막 input 이 가려지지 않도록
            form 의 가동 영역을 명시적으로 확보. pb 클래스 대비 더 명확. */}
        <div className="h-[180px]" aria-hidden="true" />
      </form>

      {/* 숫자 패드 (모바일) — 체중 / 비용 */}
      {showWeightPad && (
        <NumberPad
          value={weight}
          onChange={setWeight}
          decimal
          maxIntDigits={3}
          maxDecimals={2}
          label={t('record.field.weight')}
          suffix={weightUnit(region)}
          onClose={() => setShowWeightPad(false)}
        />
      )}
      {showCostPad && (
        <NumberPad
          value={cost}
          onChange={setCost}
          decimal={currencyDecimals(curr) > 0}
          maxDecimals={currencyDecimals(curr)}
          maxIntDigits={8}
          thousands={currencyDecimals(curr) === 0}
          label={t('record.field.cost')}
          suffix={currencyDecimals(curr) > 0 ? undefined : t('record.form.wonSuffix')}
          onClose={() => setShowCostPad(false)}
        />
      )}

      {/* Bottom Save Button */}
      <div className="fixed bottom-[calc(4rem_+_env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 z-10 keyboard-hide-on-open">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? t('record.form.saving') : t('common.save')}
        </button>
      </div>

      {/* 알림 기능 업그레이드 안내 팝업 */}
      {showAlarmUpgrade && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-gray-800">{t('record.form.alarmFeatureTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1 break-keep break-words">
              {!isPWA ? t('record.form.alarmUpsellApp') : t('record.form.alarmUpsellWeb')}
            </p>
            <p className="text-xs text-gray-400 mb-4 break-keep break-words">{t('record.form.alarmUpsellDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAlarmUpgrade(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {t('record.form.viewPlans')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showExitConfirm}
        title={t('record.form.leaveTitle')}
        message={t('record.form.leaveMessage')}
        confirmLabel={t('record.form.leave')}
        cancelLabel={t('record.form.keepEditing')}
        variant="danger"
        onConfirm={() => {
          // "나가기" = 수정 포기. draft + 세션 마커 모두 정리 → 다음 진입 시 모달 안 뜸.
          setShowExitConfirm(false);
          clearDraftAndSession();
          guardPushedRef.current = false;
          // 가짜 히스토리 항목 + 실제 뒤로가기 → 2단계 back
          window.history.go(-2);
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Draft 복원 — record 로드 후 localStorage 에 더 최신 draft 있으면 띄움.
          [불러오기] = state 에 적용 (서버 값 덮어씀) / [새로 시작] = draft 삭제, 서버 record 그대로. */}
      <ConfirmModal
        open={!!pendingDraft}
        title={t('record.form.draftTitle')}
        message={
          <>
            <p>{t('record.form.draftMessage1')}</p>
            <p className="mt-2 text-[10px] text-gray-400">
              {t('record.form.draftMessage2Edit')}
            </p>
          </>
        }
        confirmLabel={t('record.form.draftLoad')}
        cancelLabel={t('record.form.draftNew')}
        onConfirm={applyDraft}
        onCancel={discardDraft}
      />
    </div>
  );
}
