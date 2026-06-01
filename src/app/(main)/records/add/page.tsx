'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Stethoscope, AlertCircle, Building2, Plus, X, Bell, BellOff, Pill, Paperclip, Trash2, Loader2, PawPrint, Utensils, Footprints, CircleDot, Droplet, Smile, MoreHorizontal } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, RecordType, DailySubKind } from '@/lib/supabase';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { FileUploader } from '@/components/records/FileUploader';
import { ColorPicker } from '@/components/records/ColorPicker';
import { uploadFile, saveFileRecord, checkStorageLimit } from '@/services/fileUpload';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetSelectDropdown } from '@/components/records/PetSelectDropdown';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { saveDraft, loadDraft, clearDraft, draftKey, type RecordDraft } from '@/lib/recordDraft';

const recordTypes = [
  { id: 'symptom' as RecordType, label: '증상 기록', icon: AlertCircle, color: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'visit' as RecordType, label: '진료 기록', icon: Stethoscope, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'hospitalization' as RecordType, label: '입퇴원', icon: Building2, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'daily' as RecordType, label: '일상 기록', icon: PawPrint, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300' },
];

// 일상 세부 종류 — 라벨/아이콘.
// 새 sub_kind 추가 시 supabase.ts 의 DailySubKind 와 함께 확장.
// 수분은 식사 옆 배치 (의학적 연결, 매일 함께 체크하는 흐름).
const dailySubKinds: { id: DailySubKind; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'meal',      label: '식사', icon: Utensils       },
  { id: 'hydration', label: '수분', icon: Droplet        },
  { id: 'walk',      label: '산책', icon: Footprints     },
  { id: 'poop',      label: '배변', icon: CircleDot      },
  { id: 'mood',      label: '기분', icon: Smile          },
  { id: 'other',     label: '기타', icon: MoreHorizontal },
];

// v12: sub_kind 는 분류 태그 역할만, 메모는 description 1개로 통합.
// sub_entries 는 [{sub_kind}, ...] 형태로 저장 (memo/time 사용 X, DB 스키마는 호환).

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
  // v12: 선택한 sub_kind 목록만 추적 (멀티 선택 가능, 중복 X). 메모는 description state 활용.
  const [selectedSubKinds, setSelectedSubKinds] = useState<DailySubKind[]>([]);
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
  // Draft 복원 모달 — 진입 시 draft 있으면 모달 띄움.
  const [pendingDraft, setPendingDraft] = useState<RecordDraft | null>(null);
  // draft 로드 1회만 (마운트 시) — 초기 폼에 draft 적용 후 isDirty 켜야 하므로 별도 flag.
  const draftCheckedRef = useRef(false);
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
  // 브라우저 알림 권한 상태: 'default' (미결정), 'granted' (허용), 'denied' (차단), null (미지원)
  // 알림 토글 ON 클릭 시 이 값으로 분기.
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  // Soft-prompt 모달: permission='default' 상태에서 알림 토글 ON 클릭 시 표시.
  // requestPermission 호출 전에 "받을게요 / 취소" 로 사용자 의사 확인 → default→denied 영구차단 리스크 완화.
  const [pendingPushIdx, setPendingPushIdx] = useState<number | null>(null);
  // 토글 ON 시 subscribe 진행 중 인디케이터. iOS 에선 ~1-2초 걸려 사용자에게
  // "처리 중" 표시 필요. -1 = 아무 토글도 진행 안 함.
  const [subscribingIdx, setSubscribingIdx] = useState<number>(-1);

  const isPaidUser = getEffectivePlan(profile?.plan) === 'plus';
  const canUseAlarm = isPWA && isPaidUser;

  useEffect(() => {
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }

    // 권한 상태 변경 실시간 감지.
    // 사용자가 OS/브라우저 설정에서 알림 권한을 바꿔도 페이지 리로드 없이
    // UI 가 갱신되도록 Permissions API 의 change 이벤트 구독.
    // Safari/구 브라우저는 query 자체가 없거나 'notifications' 지원 안 해서 catch 로 흘림.
    let status: PermissionStatus | null = null;
    const update = () => {
      if (!status) return;
      // Permissions API 는 'prompt' / 'granted' / 'denied' 반환.
      // Notification.permission 은 'default' / 'granted' / 'denied'.
      // 'prompt' → 'default' 로 매핑해서 NotificationPermission 타입 맞춤.
      const mapped: NotificationPermission =
        status.state === 'granted' ? 'granted' :
        status.state === 'denied' ? 'denied' : 'default';
      setNotifPermission(mapped);
    };
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then(s => {
        status = s;
        update();
        s.addEventListener('change', update);
      }).catch(() => {});
    }

    // 백업: 탭 가시성 변경 시 한 번 더 동기화 (설정 앱 갔다 돌아올 때).
    // Permissions API 가 change 이벤트 놓치는 엣지 케이스 방어.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && typeof Notification !== 'undefined') {
        setNotifPermission(Notification.permission);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      status?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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

  // 뱃지 토글 — 있으면 제거, 없으면 추가. 중복 X.
  const toggleDailySubKind = (kind: DailySubKind) => {
    setSelectedSubKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  };

  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false);

  // ⚠️ dep 에 `user` 객체 X — Supabase auth 가 토큰 refresh 시 setUser(new ref)
  // 호출하면 effect 재실행되어 setPetId 가 사용자 선택을 덮어쓰는 버그 가능.
  // user?.id (primitive) 로 비교해야 안전.
  useEffect(() => {
    if (!user?.id) return;
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
  }, [user?.id]);

  // Draft 로드 — 마운트 시 1회.
  // - 같은 PWA 세션 (사용자가 입력 중 다른 앱 갔다 옴) → 모달 없이 자동 복원
  // - 새 세션 (PWA 종료 후 재실행, 어제 멈춘 draft) → 모달로 [불러오기]/[새로 시작] 묻기
  // sessionStorage 는 PWA 닫으면 초기화되므로 자연스럽게 세션 구분됨.
  useEffect(() => {
    if (!user || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const draft = loadDraft(draftKey.add(user.id));
    if (!draft) {
      // draft 없어도 세션 마커는 켜둠 (앞으로 저장될 draft 의 세션 기준)
      try { sessionStorage.setItem('pawdex-add-session', '1'); } catch {}
      return;
    }
    let sameSession = false;
    try { sameSession = sessionStorage.getItem('pawdex-add-session') === '1'; } catch {}
    if (sameSession) {
      // 같은 세션 — 모달 없이 직접 복원
      if (draft.recordType) setRecordType(draft.recordType);
      if (draft.petId) setPetId(draft.petId);
      if (draft.title !== undefined) setTitle(draft.title);
      if (draft.description !== undefined) setDescription(draft.description);
      if (draft.hospitalName !== undefined) setHospitalName(draft.hospitalName);
      if (draft.cost !== undefined) setCost(draft.cost);
      if (draft.weight !== undefined) setWeight(draft.weight);
      if (draft.symptomTime !== undefined) setSymptomTime(draft.symptomTime);
      if (draft.visitDate) setVisitDate(draft.visitDate);
      if (draft.dischargeDate !== undefined) setDischargeDate(draft.dischargeDate);
      if (draft.nextAppointmentDate !== undefined) setNextAppointmentDate(draft.nextAppointmentDate);
      if (draft.recordColor) setRecordColor(draft.recordColor);
      if (draft.nextAppointmentColor) setNextAppointmentColor(draft.nextAppointmentColor);
      if (draft.selectedSubKinds) setSelectedSubKinds(draft.selectedSubKinds);
      // setIsDirty 호출 X — 자동 복원만으로는 dirty 안 켬.
      // 사용자가 실제 form 건드려야 form onChange 로 자동 dirty.
    } else {
      // 새 세션 — 모달로 확인
      setPendingDraft(draft);
    }
    try { sessionStorage.setItem('pawdex-add-session', '1'); } catch {}
  }, [user]);

  // 매 render 마다 최신 state 를 ref 에 mirror — pagehide/visibility 핸들러가 closure
  // stale 안 되게. useRef 는 mutation 이 동기적이라 ms 단위 안전망에서 안전.
  const stateRef = useRef<RecordDraft>({});
  stateRef.current = {
    recordType, title, description, hospitalName, cost, weight, symptomTime,
    visitDate, dischargeDate, nextAppointmentDate, recordColor, nextAppointmentColor,
    petId, selectedSubKinds,
  };
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Draft 즉시 저장 — state 변경 시 fire. 단, 사용자가 실제로 form 을 건드렸을 때만 (isDirty).
  // → 페이지 열어보기만 하고 닫은 케이스에선 draft 안 만듦 → 다음 진입 시 모달 X.
  useEffect(() => {
    if (!user || pendingDraft || !isDirty) return;
    saveDraft(draftKey.add(user.id), stateRef.current);
  }, [user, pendingDraft, isDirty, recordType, title, description, hospitalName, cost, weight, symptomTime,
      visitDate, dischargeDate, nextAppointmentDate, recordColor, nextAppointmentColor,
      petId, selectedSubKinds]);

  // 백그라운드 안전망 — listener 는 user 만 dep 으로 1회 attach. ref 로 최신값 읽음.
  useEffect(() => {
    if (!user) return;
    const save = () => {
      if (pendingDraftRef.current || !isDirtyRef.current) return; // 모달 중 / 변경 X 면 skip
      saveDraft(draftKey.add(user.id), stateRef.current);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
    };
  }, [user]);

  // 복원 모달 [불러오기] — draft 의 모든 필드를 state 에 적용 후 isDirty 켜기.
  const applyDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.recordType) setRecordType(pendingDraft.recordType);
    if (pendingDraft.petId) setPetId(pendingDraft.petId);
    if (pendingDraft.title !== undefined) setTitle(pendingDraft.title);
    if (pendingDraft.description !== undefined) setDescription(pendingDraft.description);
    if (pendingDraft.hospitalName !== undefined) setHospitalName(pendingDraft.hospitalName);
    if (pendingDraft.cost !== undefined) setCost(pendingDraft.cost);
    if (pendingDraft.weight !== undefined) setWeight(pendingDraft.weight);
    if (pendingDraft.symptomTime !== undefined) setSymptomTime(pendingDraft.symptomTime);
    if (pendingDraft.visitDate) setVisitDate(pendingDraft.visitDate);
    if (pendingDraft.dischargeDate !== undefined) setDischargeDate(pendingDraft.dischargeDate);
    if (pendingDraft.nextAppointmentDate !== undefined) setNextAppointmentDate(pendingDraft.nextAppointmentDate);
    if (pendingDraft.recordColor) setRecordColor(pendingDraft.recordColor);
    if (pendingDraft.nextAppointmentColor) setNextAppointmentColor(pendingDraft.nextAppointmentColor);
    if (pendingDraft.selectedSubKinds) setSelectedSubKinds(pendingDraft.selectedSubKinds);
    setIsDirty(true);
    setPendingDraft(null);
  };

  // 복원 모달 [새로 시작] — draft 폐기 + 모달 닫기.
  // 세션 마커는 그대로 유지 (이미 켜져 있음). 새 입력 → save 후 다른 앱 갔다 와도
  // 같은 세션 → 자동 복원되어 입력 그대로 보임.
  const discardDraft = () => {
    if (user) clearDraft(draftKey.add(user.id));
    setPendingDraft(null);
  };

  const addMedicationRow = () => {
    // alarm_enabled 디폴트 false: 사용자의 명시적 opt-in 요구. 이전에는
    // canUseAlarm(=TWA+Plus) 이면 자동 ON 이었는데, 그러면 저장 순간 사용자
    // 의사와 무관하게 알림 ON 상태로 저장되는 케이스가 있었다. 지금은 사용자가
    // 직접 토글을 ON 으로 눌러야만 alarm=true 가 되고, 그 행위를 "알림 받겠다"
    // 는 명시적 의사로 해석해 저장 시 silent subscribe 까지 연결한다.
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', color: '#EC4899', alarm_enabled: false, alarm_times: ['09:00'] },
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

  const toggleMedAlarm = async (index: number) => {
    const turningOn = !medications[index].alarm_enabled;
    // OFF → ON 이고 브라우저 권한이 미결정 상태면 soft-prompt 먼저.
    // (permission=default 에서 바로 requestPermission 을 호출하면 사용자가
    // 당황해서 "허용 안 함" 누를 위험 → 영구 차단. 컨텍스트 모달로 완화.)
    //
    // 단, iOS Safari PWA 에서 Notification.permission 이 'default' 로
    // 잘못 리턴되는 quirk 가 있어, 실제 구독 존재 시엔 granted 로 간주하고
    // soft-prompt 스킵 → 마이페이지로 ON 한 유저가 records/add 에서
    // 매번 "받을게요" 모달 뜨는 문제 방지.
    // "subscribe 진행해야 할지" 판별 — 실제 구독 존재 여부로 결정 (iOS Safari
    // PWA 에서 Notification.permission 이 'default' 로 잘못 리턴돼도 정확히 동작).
    let shouldSubscribe = false;
    if (turningOn && canUseAlarm) {
      const browserGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
      let hasExistingSub = false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        hasExistingSub = !!(await reg?.pushManager.getSubscription());
      } catch {}

      if (browserGranted || hasExistingSub) {
        // 권한 있음 (또는 iOS quirk: 구독은 있는데 permission 이 default 로 보임)
        shouldSubscribe = true;
      } else if (notifPermission === 'default') {
        // 진짜 처음 — soft-prompt 먼저 (default→denied 영구차단 리스크 완화)
        setPendingPushIdx(index);
        return;
      }
      // denied 는 인라인 안내가 알아서 뜸 (setMedications 로 토글은 진행)
    }

    // 즉시 UI 반영
    setMedications(medications.map((m, i) => (i === index ? { ...m, alarm_enabled: turningOn } : m)));

    // user-gesture 콜스택 안에서 즉시 subscribe (iOS Safari 요구사항). 멱등.
    if (shouldSubscribe && user) {
      setSubscribingIdx(index);
      try {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'toggle-subscribe' },
            extra: { reason: result.reason },
          });
        } else {
          // iOS quirk 로 notifPermission 이 default 였다면 이제 granted 로 동기화
          if (notifPermission !== 'granted' && typeof Notification !== 'undefined') {
            setNotifPermission(Notification.permission);
          }
        }
      } finally {
        setSubscribingIdx(-1);
      }
    }
  };

  // Soft-prompt 모달에서 [받을게요] 클릭: 브라우저 권한 요청 → 허용/거부 결과로 분기.
  const handlePushPromptAllow = async () => {
    const idx = pendingPushIdx;
    setPendingPushIdx(null);
    if (idx === null || typeof Notification === 'undefined') return;
    setSubscribingIdx(idx);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      // 허용이든 거부든 약 토글은 ON 으로 (사용자 의도 반영). 거부면 인라인 안내가 보이게 됨.
      setMedications(prev => prev.map((m, i) => (i === idx ? { ...m, alarm_enabled: true } : m)));
      // 권한 받자마자 같은 user-gesture 콜스택에서 subscribe (iOS 요구사항).
      // AuthContext auto-resub 에 위임하면 [user, profile] 의존이라 재실행 안 돼서 누락됨.
      if (permission === 'granted' && user) {
        const result = await ensurePushSubscribed(user.id);
        if (!result.ok) {
          Sentry.captureException(new Error(`ensurePushSubscribed failed: ${result.reason}`), {
            tags: { feature: 'push', action: 'soft-prompt-subscribe' },
            extra: { reason: result.reason },
          });
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'push', action: 'soft-prompt' } });
    } finally {
      setSubscribingIdx(-1);
    }
  };

  // Soft-prompt 모달에서 [취소] 클릭: requestPermission 호출 X → permission=default 유지.
  // 나중에 사용자가 마음 바뀌면 다시 토글 시도 가능.
  const handlePushPromptCancel = () => {
    setPendingPushIdx(null);
    // 토글은 OFF 로 유지 (flip 안 함)
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // ── 변경 감지 + 이탈 방어 ──
  // beforeunload 가드 제거 — 브라우저 네이티브 "사이트를 새로고침하겠습니까?" 다이얼로그는
  // 디자인 커스텀 불가하고 못생김. draft 자동 저장으로 데이터 보호하므로 가드 자체 불필요.
  // 새로고침/탭 닫기 시 pagehide 가 draft 저장 보장 → 다시 진입 시 자동 복원.
  // 뒤로가기는 popstate guard + ConfirmModal 로 별도 처리 (커스텀 UI).

  // ⚠️ 빠른 연속 back press race 방어 (Chrome 네이티브 다이얼로그 추가 노출 버그):
  //   이전 코드는 popstate handler 안에서 setTimeout(50ms) 후에 fake state 를
  //   push 했음. 안드로이드 TWA 에서 50ms 안에 두 번째 back 이 들어오면 그 사이에
  //   /add 페이지가 history 에서 unwind 됨 → beforeunload 발사 → Chrome 네이티브
  //   다이얼로그가 우리 ConfirmModal 위에 겹쳐 떴음.
  //   → 해결: popstate 즉시 (sync) fake state 다시 push. iOS peek 검사 제거.
  //   iOS 스와이프 peek-cancel 시 모달이 살짝 뜰 수 있지만 [계속 수정] 한 번 누르면
  //   되고, Android 의 다이얼로그 중복 버그가 더 큰 문제.
  useEffect(() => {
    if (!isDirty) return;
    if (!guardPushedRef.current) {
      window.history.pushState({ addGuard: true }, '');
      guardPushedRef.current = true;
    }
    const handler = () => {
      // sync 즉시 push — 빠른 연속 back 으로 /add 페이지가 history 에서 빠지는 race 차단
      window.history.pushState({ addGuard: true }, '');
      if (isDirty && !saving && window.location.pathname.includes('/add')) {
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) { router.push('/login'); return; }
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (!petId) { showError('반려동물을 선택해주세요.'); return; }
    // 일상: 세부 종류 1개 이상 + 모든 entry 의 메모 필수 (빈값 저장 차단).
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
      if (files.length > 0) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const storage = await checkStorageLimit(token);
          if (!storage.canUpload) {
            showError(
              isPaidUser
                ? `저장 공간이 부족해요(${storage.limitMB}MB) 추가 용량이 필요하시면 문의해 주세요`
                : `저장 공간이 부족해요(${storage.limitMB}MB) Plus로 업그레이드하여 용량을 늘려보세요!`,
            );
            setSaving(false);
            return;
          }
        }
      }

      // 일상은 자동 제목 + 세부 종류 JSON 만 저장. 캘린더 반영 X (color/날짜 컬럼은 사용 안 함).
      // title 은 NOT NULL 이라 "일상 기록" 로 채움 (펫 이름은 표시 시 join 으로 가져옴).
      let record;
      if (recordType === 'daily') {
        // v12: sub_entries 는 sub_kind 만 저장 (분류 태그). 메모는 description 1개로 통합.
        const subEntries = selectedSubKinds.map((k) => ({ sub_kind: k }));
        record = await createRecord({
          pet_id: petId,
          record_type: 'daily',
          title: '일상 기록',
          description: description.trim(),
          visit_date: visitDate,
          sub_entries: subEntries,
        });
      } else {
        record = await createRecord({
          pet_id: petId,
          record_type: recordType,
          title: title.trim(),
          description: description.trim() || undefined,
          hospital_name: hospitalName.trim() || undefined,
          visit_date: visitDate,
          cost: cost ? Math.min(Math.max(0, Math.round(Number(cost))), 10000000) : undefined,
          color: recordType === 'symptom' ? '#F97316' : recordType === 'hospitalization' ? '#22C55E' : recordColor,
          discharge_date: recordType === 'hospitalization' && dischargeDate ? dischargeDate : undefined,
          next_appointment_date: nextAppointmentDate || undefined,
          next_appointment_color: nextAppointmentDate ? nextAppointmentColor : undefined,
          symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : undefined,
          weight: weight ? Number(weight) : undefined,
        });
      }

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

      // ── 저장 시 silent subscribe 체크 ──
      //
      // 사용자가 약을 alarm_enabled=true 로 저장한 건 "알림을 받겠다" 는
      // 명시적 의사 표명. 저장 직후 조용히 점검:
      //   1) permission 이 granted 가 아니면 스킵 (denied 는 인라인 안내가
      //      이미 보였을 것, default 는 토글 단계 soft-prompt 가 처리)
      //   2) 이미 구독 있으면 스킵 (정상 상태)
      //   3) 구독 없으면 조용히 생성 + 서버 등록
      //   4) profiles.is_push_enabled = true 로 덮어쓰기
      //
      // 이 4번이 "의사 재표명" 의 핵심:
      //   과거에 마이페이지 토글로 OFF 눌렀던 유저 (is_push_enabled=false)
      //   라도, 약 추가에서 알림 ON 으로 저장하는 순간 DB 값을 true 로 갱신 →
      //   AuthContext auto-resub 의 skip 조건에서 벗어남 → 다음 로드 시 자동
      //   복구 포함해 sync 됨.
      //
      // 실패는 Sentry 로만 로깅. 사용자 UI 방해 없음. 기록 저장 자체는 이미
      // 완료된 상태라 이 단계 실패가 전체 저장을 롤백하지 않음.
      // 저장 시점 silent subscribe — 토글 시점에서 이미 처리됐을 가능성 높지만
      // 백업으로 한 번 더 시도 (헬퍼는 멱등).
      // 단 iOS Safari 는 user-gesture 만료로 subscribe 거부될 수 있음 →
      // 토글 시점 처리가 중요. 이 백업은 Android 위주로 안전망 역할.
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

      // 저장 성공 → draft 삭제 + 세션 마커 해제 + dirty 해제 후 이동.
      // 세션 마커 해제: 다음 add 진입 시 (예: 같은 PWA 세션 안에서 곧바로 또 작성)
      // 모달 없이 빈 폼으로 시작. 새 draft 저장되면 자동으로 다시 마커 켜짐.
      if (user) clearDraft(draftKey.add(user.id));
      try { sessionStorage.removeItem('pawdex-add-session'); } catch {}
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

        {/* Pet Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">반려동물</label>
          {pets.length > 0 ? (
            <PetSelectDropdown pets={pets} value={petId} onChange={setPetId} />
          ) : (
            <p className="text-xs text-gray-400">등록된 반려동물이 없습니다.</p>
          )}
        </div>

        {/* 일상 — 세부 종류 멀티 선택 (분류 태그) + 통합 메모 1개 (일기 형식) */}
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
                    onClick={() => { toggleDailySubKind(sk.id); setIsDirty(true); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium border-2 transition-colors ${
                      selected
                        ? 'bg-white text-blue-600 border-blue-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={14} />
                    {sk.label}
                  </button>
                );
              })}
            </div>

            {/* 통합 메모 1개 — 일기 형식. sub_kind 선택 여부와 별개로 항상 노출. */}
            <div className="mt-4">
              <label className="text-sm font-medium block mb-2">메모</label>
              <textarea
                placeholder="오늘 하루를 기록해보세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white min-h-[220px] resize-none"
              />
            </div>
          </div>
        )}

        {/* Title (일상 제외) */}
        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '진료 사유'}
          </label>
          <input
            type="search"
            placeholder={recordType === 'symptom' ? '예: 구토, 설사' : recordType === 'hospitalization' ? '예: 슬개골 수술, 장염 치료' : '예: 건강검진, 예방접종'}
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
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
              maxLength={6}
              autoComplete="off"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {/* Date (일상 제외) */}
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
          {showHospitalFields && (
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
              placeholder="상세 내용을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={700}
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
                  maxLength={30}
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
                  maxLength={20}
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
                  maxLength={20}
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
                  {/* 알림 ON 인데 브라우저 권한이 'denied' (차단) 면 인라인 안내.
                      DB 에 alarm_enabled=true 는 저장되지만 실제로 푸시 안 옴 →
                      사용자한테 명확히 알려주고 복구 경로(기기 설정) 링크 제공. */}
                  {canUseAlarm && med.alarm_enabled && notifPermission === 'denied' && i === 0 && (
                    <div className="flex items-start gap-1.5 px-2 py-1.5 mt-1 bg-red-50 border border-red-100 rounded-md text-[11px] text-red-600 leading-snug">
                      <BellOff size={11} className="flex-shrink-0 mt-0.5" />
                      <p>
                        브라우저 알림이 차단되어 있어요! 브라우저 앱 설정에서 알림 허용으로 변경 후 다시 시도해주세요
                      </p>
                    </div>
                  )}
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

        {/* ── 첨부파일 섹션 (일상 제외 — v1.0 에선 첨부 미지원, 용량 부담 회피) ── */}
        {recordType !== 'daily' && (
          <>
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
          </>
        )}
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
        onConfirm={() => {
          // "나가기" = 작성 포기. draft + 세션 마커 모두 정리 → 다음 진입 시 모달 안 뜸.
          setShowExitConfirm(false);
          setIsDirty(false);
          guardPushedRef.current = false;
          if (user) clearDraft(draftKey.add(user.id));
          try { sessionStorage.removeItem('pawdex-add-session'); } catch {}
          window.history.go(-2);
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Draft 복원 — 마운트 시 localStorage 에 임시 저장된 내용이 있으면 띄움.
          [불러오기] = 폼에 복원 / [새로 시작] = draft 삭제 후 빈 폼.
          약·첨부 파일은 의도적으로 draft 에 포함 안 했으므로 안내 문구로 분리 처리. */}
      <ConfirmModal
        open={!!pendingDraft}
        title="이전 작성 중인 내용 불러올까요?"
        message={
          <>
            <p>최근 작성하다가 멈춘 내용이 있어요.</p>
            <p className="mt-2 text-[10px] text-gray-400">
              약·첨부 파일은 다시 선택해주세요
            </p>
          </>
        }
        confirmLabel="불러오기"
        cancelLabel="새로 시작"
        onConfirm={applyDraft}
        onCancel={discardDraft}
      />

      {/* Soft-prompt: 알림 권한 'default' 상태에서 알림 토글 ON 시도 시.
          requestPermission 호출 전 컨텍스트 안내 → 사용자가 [받을게요] 누른
          직후에만 실제 OS 팝업이 뜸. [취소] 누르면 OS 팝업 아예 안 뜸 → default
          유지 → 나중에 다시 시도 가능.
          아이콘/배경은 마이페이지 denied 모달과 통일 (Bell + orange-50). */}
      <ConfirmModal
        open={pendingPushIdx !== null}
        title="알림을 켜시겠어요?"
        icon={<Bell size={16} className="text-orange-500" />}
        bgClassName="bg-orange-50"
        message={
          <>
            <p>투약 시간 / 예약일 / 퇴원일 잊지 않게 푸시 알림 보내드려요!</p>
            <p className="mt-2 text-[10px] text-gray-400">
              [받을게요] 를 누르면 시스템 권한 창이 떠요
            </p>
          </>
        }
        confirmLabel="받을게요"
        cancelLabel="나중에"
        onConfirm={handlePushPromptAllow}
        onCancel={handlePushPromptCancel}
      />
    </div>
  );
}
