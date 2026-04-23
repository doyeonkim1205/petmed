'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Stethoscope, AlertCircle, Building2, Plus, X, Bell, BellOff, Pill, Paperclip, Trash2 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, RecordType } from '@/lib/supabase';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { FileUploader } from '@/components/records/FileUploader';
import { ColorPicker } from '@/components/records/ColorPicker';
import { uploadFile, saveFileRecord, checkStorageLimit } from '@/services/fileUpload';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';

const recordTypes = [
  { id: 'symptom' as RecordType, label: '증상 기록', icon: AlertCircle, color: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'visit' as RecordType, label: '진료 기록', icon: Stethoscope, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'hospitalization' as RecordType, label: '입퇴원', icon: Building2, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
];

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

interface MedicationInput {
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
  color: string;
  alarm_enabled: boolean;
  alarm_times: string[];
}

export default function RecordAddPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { createRecord } = useHealthRecords();
  const { addMedication } = useMedications();
  // alarm_enabled 는 그냥 DB 에 저장. 실제 푸시 발송 여부는 서버 cron 이
  // push_subscriptions 엔드포인트 유무로 판단. 사용자는 원할 때 마이페이지
  // 에서 푸시 알림 토글로 구독을 켠다 (이전 흐름).
  const medEndRef = useRef<HTMLDivElement>(null);
  const fileEndRef = useRef<HTMLDivElement>(null);

  const [pets, setPets] = useState<Pet[]>([]);
  const [recordType, setRecordType] = useState<RecordType>('symptom');
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptomTime, setSymptomTime] = useState('');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const [recordColor, setRecordColor] = useState('#3B82F6');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentColor, setNextAppointmentColor] = useState('#8B5CF6');
  const [dischargeDate, setDischargeDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const guardPushedRef = useRef(false);
  const [error, setError] = useState('');
  const [isPWA, setIsPWA] = useState(false);
  const [showAlarmUpgrade, setShowAlarmUpgrade] = useState(false);

  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  // 유형 전환 시 입력값 캐시 (돌아왔을 때 복원)
  const typeDataCache = useRef<Partial<Record<RecordType, {
    title: string; description: string; hospitalName: string; cost: string;
    symptomTime: string; dischargeDate: string; nextAppointmentDate: string;
    nextAppointmentColor: string; recordColor: string; medications: MedicationInput[];
    files: File[];
  }>>>({});

  const handleTypeChange = (newType: RecordType) => {
    if (newType === recordType) return;
    typeDataCache.current[recordType] = {
      title, description, hospitalName, cost, symptomTime,
      dischargeDate, nextAppointmentDate, nextAppointmentColor, recordColor, medications,
      files,
    };
    const cached = typeDataCache.current[newType];
    if (cached) {
      setTitle(cached.title); setDescription(cached.description);
      setHospitalName(cached.hospitalName); setCost(cached.cost);
      setSymptomTime(cached.symptomTime); setDischargeDate(cached.dischargeDate);
      setNextAppointmentDate(cached.nextAppointmentDate);
      setNextAppointmentColor(cached.nextAppointmentColor);
      setRecordColor(cached.recordColor); setMedications(cached.medications);
      setFiles(cached.files);
    } else {
      setTitle(''); setDescription(''); setHospitalName(''); setCost('');
      setSymptomTime(''); setDischargeDate(''); setNextAppointmentDate('');
      setNextAppointmentColor('#8B5CF6');
      setRecordColor(newType === 'symptom' ? '#F97316' : newType === 'hospitalization' ? '#22C55E' : '#3B82F6');
      setMedications([]);
      setFiles([]);
    }
    setRecordType(newType);
  };

  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const petList = data || [];
        setPets(petList);
        if (petList.length === 1) {
          setPetId(petList[0].id);
        } else {
          const defaultId = localStorage.getItem('defaultPetId');
          if (defaultId && petList.some(p => p.id === defaultId)) {
            setPetId(defaultId);
          }
        }
      });
    // 최근 병원명 DB 에서 로드 (기기 간 동기화). 기존 localStorage 값이 있으면
    // 한 번만 DB 로 올리고 로컬 삭제하는 one-shot 마이그레이션 수행.
    (async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const legacy: string[] = (() => {
          try { return JSON.parse(localStorage.getItem('recentHospitals') || '[]'); } catch { return []; }
        })();
        if (legacy.length > 0) {
          await authFetch('/api/recent-hospitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: legacy }),
          });
          localStorage.removeItem('recentHospitals');
        }
        const res = await authFetch('/api/recent-hospitals');
        if (res.ok) {
          const names: string[] = await res.json();
          setHospitalSuggestions(names);
        }
      } catch {}
    })();
  }, [user]);

  const addMedicationRow = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', color: '#EC4899', alarm_enabled: !!canUseAlarm, alarm_times: ['09:00'] },
    ]);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 200);
  };

  const updateMedication = (index: number, field: keyof MedicationInput, value: string) => {
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

  const toggleMedAlarm = (index: number) => {
    setMedications(medications.map((m, i) => (i === index ? { ...m, alarm_enabled: !m.alarm_enabled } : m)));
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // ── 변경 감지 + 이탈 방어 ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // iOS Safari "미완성 제스처" 대응:
  //   스와이프 백을 중간까지 밀고 놓으면 브라우저가 peek 후 취소해도
  //   popstate 가 발동되는 경우가 있음. 50ms 뒤 history.state 를
  //   재확인해서 guard 가 여전히 있으면 (= 제스처 취소됨) 모달 안 띄움.
  useEffect(() => {
    if (!isDirty) return;
    if (!guardPushedRef.current) {
      window.history.pushState({ addGuard: true }, '');
      guardPushedRef.current = true;
    }
    const handler = () => {
      setTimeout(() => {
        if (window.history.state?.addGuard) return;
        if (isDirty && !saving && window.location.pathname.includes('/add')) {
          window.history.pushState({ addGuard: true }, '');
          setShowExitConfirm(true);
        }
      }, 50);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty, saving]);

  const handleBack = () => {
    if (saving) return;
    if (isDirty) setShowExitConfirm(true);
    else router.back();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) { router.push('/login'); return; }
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (!petId) { showError('반려동물을 선택해주세요.'); return; }
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

    setSaving(true);
    setError('');

    try {
      if (files.length > 0) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const storage = await checkStorageLimit(token);
          if (!storage.canUpload) {
            showError(`저장 용량(${storage.limitMB}MB)을 초과했습니다. 기존 파일을 삭제하거나 플랜을 업그레이드하세요.`);
            setSaving(false);
            return;
          }
        }
      }

      const record = await createRecord({
        pet_id: petId,
        record_type: recordType,
        title: title.trim(),
        description: description.trim() || undefined,
        hospital_name: hospitalName.trim() || undefined,
        visit_date: visitDate,
        cost: cost ? Math.min(Math.max(0, Math.round(Number(cost))), 100000000) : undefined,
        color: recordType === 'symptom' ? '#F97316' : recordType === 'hospitalization' ? '#22C55E' : recordColor,
        discharge_date: recordType === 'hospitalization' && dischargeDate ? dischargeDate : undefined,
        next_appointment_date: nextAppointmentDate || undefined,
        next_appointment_color: nextAppointmentDate ? nextAppointmentColor : undefined,
        symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : undefined,
        weight: weight ? Number(weight) : undefined,
      });

      for (const file of files) {
        try {
          const { path } = await uploadFile(file, user.id, record.id);
          await saveFileRecord({
            record_id: record.id,
            user_id: user.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
          });
        } catch (err) {
          console.error('File upload error:', err);
        }
      }

      for (const med of medications) {
        if (!med.name.trim()) continue;
        try {
          await addMedication({
            record_id: record.id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || undefined,
            frequency: med.frequency,
            color: med.color,
            alarm_enabled: med.alarm_enabled,
            alarm_times: med.alarm_enabled ? med.alarm_times : [],
          });
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: 'medications', action: 'add' },
            extra: { userId: user?.id, medicationName: med.name },
          });
          console.error('Medication add error:', err);
        }
      }

      // 병원명 저장 시 최근 목록(DB) 갱신 — last_used_at 만 바뀌어도 자동완성
      // 상단에 뜨도록. 실패해도 기록 저장은 성공했으니 조용히 무시.
      const hn = hospitalName.trim();
      if (hn) {
        try {
          const { authFetch } = await import('@/lib/authFetch');
          await authFetch('/api/recent-hospitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: hn }),
          });
        } catch {}
      }

      // 저장 성공 → dirty 해제 후 이동
      setIsDirty(false);
      guardPushedRef.current = false;
      router.push('/records');
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'records', action: 'create' },
        extra: { userId: user?.id, recordType },
      });
      console.error('Error creating record:', err);
      setError(err instanceof Error ? err.message : '기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const showHospitalFields = recordType === 'visit' || recordType === 'hospitalization';

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10">
        <button onClick={handleBack} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 추가</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="flex-1 px-4 pb-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {/* Record Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">기록 유형</label>
          <div className="flex gap-2">
            {recordTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeChange(type.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    recordType === type.id ? type.color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 기본 정보 섹션 ── */}
        <div className="flex items-center gap-2 py-2 bg-blue-50 -mx-4 px-4">
          <Stethoscope size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">기본 정보</h3>
        </div>

        {/* Pet Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">반려동물</label>
          <select
            value={petId}
            onChange={(e) => setPetId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            {pets.length !== 1 && <option value="">선택해주세요</option>}
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} ({pet.type === 'dog' ? '강아지' : '고양이'})
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '진료 사유'}
          </label>
          <input
            type="search"
            placeholder={recordType === 'symptom' ? '예: 구토, 설사' : recordType === 'hospitalization' ? '예: 슬개골 수술, 장염 치료' : '예: 건강검진, 예방접종'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="next"
            name="record-title"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

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
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
              autoComplete="off"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {/* Date */}
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
          {showHospitalFields && (
            <ColorPicker label="캘린더 표시 색상" value={recordColor} onChange={setRecordColor}  />
          )}
        </div>

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
              placeholder="상세 내용을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
            />
          </div>
        )}

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
          <>
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">진료 정보</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                설명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                placeholder="상세 내용을 입력하세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                체중 (kg) <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="예: 3.5"
                value={weight}
                onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
                autoComplete="off"
                name="pet-weight-kg"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                병원명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <div className="relative">
                <input
                  type="search"
                  placeholder="병원명을 입력하세요"
                  value={hospitalName}
                  onChange={(e) => { setHospitalName(e.target.value); setShowHospitalSuggestions(true); }}
                  onFocus={() => setShowHospitalSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowHospitalSuggestions(false), 150)}
                  maxLength={50}
                  autoComplete="off"
                  enterKeyHint="next"
                  name="hospital-name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                {showHospitalSuggestions && hospitalSuggestions.filter(h => h.toLowerCase().includes(hospitalName.toLowerCase()) && h !== hospitalName).length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {hospitalSuggestions.filter(h => h.toLowerCase().includes(hospitalName.toLowerCase()) && h !== hospitalName).map((name) => (
                      <div key={name} className="flex items-center hover:bg-blue-50 transition-colors">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setHospitalName(name); setShowHospitalSuggestions(false); }}
                          className="flex-1 text-left px-4 py-2.5 text-sm text-gray-700"
                        >
                          {name}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={async () => {
                            // 낙관적 업데이트: UI 먼저 제거 → DB 실패해도 사용자가 기다리지 않음.
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
                비용 (원) <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
                autoComplete="off"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

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

        {/* ── 투약 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
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
              <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  type="search"
                  placeholder="약 이름"
                  value={med.name}
                  onChange={(e) => updateMedication(i, 'name', e.target.value)}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-name-${i}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                <input
                  type="search"
                  placeholder="용량 (예: 1정)"
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-dosage-${i}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
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
                      onChange={(e) => updateMedication(i, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">종료일</label>
                    <input
                      type="date"
                      value={med.end_date}
                      onChange={(e) => updateMedication(i, 'end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                </div>
                <ColorPicker
                  label="캘린더 색상"
                  value={med.color}
                  onChange={(c) => updateMedication(i, 'color', c)}
                />
                {/* 투약 알림 */}
                <div className="border-t border-gray-200 pt-2">
                  <button
                    type="button"
                    onClick={() => canUseAlarm ? toggleMedAlarm(i) : setShowAlarmUpgrade(true)}
                    className={`flex items-center gap-2 w-full py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                      med.alarm_enabled ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  >
                    {med.alarm_enabled ? <Bell size={14} /> : <BellOff size={14} />}
                    투약 알림 {med.alarm_enabled ? 'ON' : 'OFF'}
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

        {/* ── 첨부파일 섹션 ── */}
        <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
          <Paperclip size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">첨부파일</h3>
        </div>

        <div className="space-y-2">
          <FileUploader
            files={files}
            onFilesChange={(newFiles) => {
              const added = newFiles.length > files.length;
              setFiles(newFiles);
              if (added) {
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
              }
            }}
            maxFiles={getPlanConfig(getEffectivePlan(profile?.plan)).attachmentsPerRecord}
            placeholder={recordType === 'symptom' ? '증상 관련 사진이나 파일을 첨부하세요' : '진료 서류를 첨부하세요'}
          />
          <div ref={fileEndRef} />
        </div>
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
        message={<>저장되지 않은 변경사항이 있습니다.</>}
        confirmLabel="나가기"
        cancelLabel="계속 작성"
        variant="danger"
        onConfirm={() => { setShowExitConfirm(false); setIsDirty(false); guardPushedRef.current = false; window.history.go(-2); }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
