'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Stethoscope, AlertCircle, Building2, Plus, X, Bell, BellOff, Pill, Paperclip, Trash2, Loader2, PawPrint } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMarketRegion } from '@/hooks/useMarketRegion';
import { currencyForRegion, currencyDecimals, roundToCurrency, sanitizeAmountInput, formatAmountInput, weightUnit, displayWeightToKg } from '@/lib/region';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, RecordType } from '@/lib/supabase';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { FileUploader } from '@/components/records/FileUploader';
import { PlusUpgradeNotice } from '@/components/PlusUpgradeNotice';
import { ColorPicker } from '@/components/records/ColorPicker';
import { uploadFile, saveFileRecord, checkStorageLimit } from '@/services/fileUpload';
import { TimePicker } from '@/components/TimePicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PetSelectDropdown } from '@/components/records/PetSelectDropdown';
import { ensurePushSubscribed } from '@/lib/pushSubscribe';
import { isInstalledApp, isNativeApp } from '@/lib/platform';
import { type RecordDraft } from '@/lib/recordDraft';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { todayLocalISO } from '@/lib/date';
import { sortPetsWithDefault } from '@/lib/petSort';
import { DatePicker } from '@/components/ui/DatePicker';
import { NumberPad } from '@/components/ui/NumberPad';

// 한 줄 4버튼 배치 순서: 증상 · 진료 · 입퇴원 · 일상 (의료성 기록 먼저, 일상 맨 뒤)
// 라벨은 typeShort(증상/진료/입퇴원/일상) 사용 — "기록" 중복 제거 + 좁은 4버튼에 맞춰 통일.
const recordTypes = [
  { id: 'symptom' as RecordType, labelKey: 'record.typeShort.symptom', icon: AlertCircle, color: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'visit' as RecordType, labelKey: 'record.typeShort.visit', icon: Stethoscope, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'hospitalization' as RecordType, labelKey: 'record.typeShort.hospitalization', icon: Building2, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'daily' as RecordType, labelKey: 'record.typeShort.daily', icon: PawPrint, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300' },
];


// value 는 DB 저장값(한국어 고정, parseDoseCount 파싱). 표시는 labelKey 로 분리.
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
  const t = useTranslations();
  const router = useRouter();
  const { user, profile } = useAuth();
  const region = useMarketRegion();
  const curr = currencyForRegion(region);   // 입력 통화 (KRW=정수 / USD=소수 2자리)
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
  // ⚠️ toISOString() 은 UTC 라 한국 시간 새벽엔 어제 ISO date 반환 → 사용자가
  // 그대로 저장하면 visit_date 가 어제로 기록되어 홈 "마지막 기록 1일 전" 버그.
  // todayLocalISO 는 로컬 자정 기준이라 사용자 시계와 일치.
  const [visitDate, setVisitDate] = useState(todayLocalISO());
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const guardPushedRef = useRef(false);
  const [error, setError] = useState('');
  // 저장 용량 초과 — 무료 사용자에겐 Plus 업셀 카드로 안내 (유료는 일반 에러). 값=한도 MB.
  const [storageFullMb, setStorageFullMb] = useState<number | null>(null);
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

  // Chrome autofill 차단 readonly trick — focus 전에는 readOnly 라 Chrome 휴리스틱이 input 분류 안 함.
  // focus 시 readOnly 풀려 정상 입력 가능. blur 시 다시 readOnly.
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
        const defaultId = localStorage.getItem('defaultPetId');
        const petList = sortPetsWithDefault(data || [], defaultId);
        setPets(petList);
        if (petList.length === 1) {
          setPetId(petList[0].id);
        } else if (defaultId && petList.some(p => p.id === defaultId)) {
          setPetId(defaultId);
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

  // 자동 복원 / [불러오기] 시 form 적용 콜백 — 모든 setter 한 곳에 모음.
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

  // hook 에 전달할 현재 form state — 매 render 마다 새 객체 (hook 안에서 ref mirror).
  const formState: RecordDraft = {
    recordType, title, description, hospitalName, cost, weight, symptomTime,
    visitDate, dischargeDate, nextAppointmentDate, recordColor, nextAppointmentColor,
    petId,
  };

  const {
    isDirty,
    setIsDirty,
    pendingDraft,
    applyDraft,
    discardDraft,
    clearDraftAndSession,
  } = useDraftPersistence({
    variant: 'add',
    userId: user?.id,
    ready: !!user?.id,
    formState,
    onApplyDraft: applyDraftValues,
  });

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
      medEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

      if (isNativeApp() || browserGranted || hasExistingSub) {
        // 네이티브(FCM) 또는 권한 있음 (또는 iOS quirk: 구독은 있는데 permission 이 default 로 보임)
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
    setStorageFullMb(null);
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (!petId) { showError(t('record.form.error.selectPet')); return; }
    // 일상: 제목 필수, 메모는 선택.
    if (recordType === 'daily') {
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
      if (files.length > 0) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const storage = await checkStorageLimit(token);
          if (!storage.canUpload) {
            if (isPaidUser) {
              showError(t('record.form.error.storageFullApp', { mb: storage.limitMB }));
            } else {
              // 무료 → Plus 업셀 카드로 안내 (일반 에러 배너 대신)
              setError('');
              setStorageFullMb(storage.limitMB);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setSaving(false);
            return;
          }
        }
      }

      // 일상 = 제목(선택) + 메모(일기) 1개. 캘린더 반영 X (color/날짜 컬럼은 사용 안 함).
      // title 은 NOT NULL 이라 비우면 "일상 기록" 으로 fallback.
      let record;
      if (recordType === 'daily') {
        record = await createRecord({
          pet_id: petId,
          record_type: 'daily',
          title: title.trim() || '일상 기록',
          description: description.trim(),
          visit_date: visitDate,
          sub_entries: [],
        });
      } else {
        record = await createRecord({
          pet_id: petId,
          record_type: recordType,
          title: title.trim(),
          description: description.trim() || undefined,
          hospital_name: hospitalName.trim() || undefined,
          visit_date: visitDate,
          cost: cost ? Math.min(Math.max(0, roundToCurrency(Number(cost), curr)), 10000000) : undefined,
          color: recordType === 'symptom' ? '#F97316' : recordType === 'hospitalization' ? '#22C55E' : recordColor,
          discharge_date: recordType === 'hospitalization' && dischargeDate ? dischargeDate : undefined,
          // 다음 예약은 진료만 — 입퇴원에서 유형 전환 등으로 상태가 남아도 저장 안 되게 가드.
          next_appointment_date: recordType === 'visit' && nextAppointmentDate ? nextAppointmentDate : undefined,
          next_appointment_color: recordType === 'visit' && nextAppointmentDate ? nextAppointmentColor : undefined,
          symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : undefined,
          weight: weight ? displayWeightToKg(Number(weight), region) : undefined,
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
          // 첨부 실패는 Sentry 로만 보고. 사용자에겐 표시 X — record 는 이미 저장됐고
          // 약 알람 같은 후속 await 사이에 빨간 박스가 깜빡 보이는 불규칙 동작 회피.
          // 사용자가 detail 페이지 들어가서 사진 없는 거 인지 + 다시 첨부 가능.
          Sentry.captureException(err, {
            tags: { feature: 'records', action: 'file-upload' },
            extra: { userId: user.id, recordId: record.id, fileName: file.name, fileSize: file.size, fileType: file.type },
          });
          console.error('File upload error:', err);
        }
      }

      for (const med of medications) {
        if (!med.name.trim()) continue;
        try {
          await addMedication({
            record_id: record.id,
            pet_id: petId,
            kind: 'prescription',
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

      // 저장 성공 → draft + 세션 마커 정리 + dirty 해제 후 이동.
      // 다음 add 진입 시 모달 없이 빈 폼으로 시작 (마커가 비어있어 새 세션 인식).
      clearDraftAndSession();
      // 홈 브리핑 캐시 무효화 — 새 기록이 즉시 "마지막 기록" / "다음 예약" 에 반영.
      {
        const { invalidateHealthBriefing } = await import('@/lib/swrCache');
        invalidateHealthBriefing(user.id);
      }
      guardPushedRef.current = false;
      router.push('/records');
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'records', action: 'create' },
        extra: { userId: user?.id, recordType },
      });
      console.error('Error creating record:', err);
      setError(err instanceof Error ? err.message : t('record.form.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const showHospitalFields = recordType === 'visit' || recordType === 'hospitalization';

  return (
    <div className="min-h-screen bg-white flex flex-col pb-[calc(5rem_+_env(safe-area-inset-bottom))]">
      <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 bg-white z-10" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.75rem + env(safe-area-inset-top))' }}>
        <button onClick={handleBack} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">{t('record.form.addTitle')}</h1>
      </header>

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="flex-1 px-4 pb-4 space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm break-keep break-words">{error}</div>
        )}
        {storageFullMb !== null && (
          <PlusUpgradeNotice
            message={t('record.form.error.storageFullFree', { mb: storageFullMb })}
          />
        )}

        {/* Record Type Selection — 한 줄 4버튼 (증상·일상·진료·입퇴원), 아이콘 위·라벨 아래 */}
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {recordTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeChange(type.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all text-sm font-medium ${
                    recordType === type.id ? type.color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {t(type.labelKey)}
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
            {recordType === 'daily' ? t('record.type.daily') : t('record.section.basicInfo')}
          </h3>
        </div>

        {/* Pet Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('common.pet')}</label>
          {pets.length > 0 ? (
            <PetSelectDropdown pets={pets} value={petId} onChange={setPetId} />
          ) : (
            <p className="text-xs text-gray-400">{t('record.form.noPets')}</p>
          )}
        </div>

        {/* 일상 — 제목(선택) + 메모(일기) 1개. */}
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

        {/* Title (일상 제외) */}
        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t(`record.form.titleLabel.${recordType}`)}
          </label>
          <input
            type="search"
            placeholder={t(`record.form.titlePlaceholder.${recordType}`)}
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
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) setWeight(v);
              }}
              maxLength={6}
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
        )}

        {/* Date (일상 제외) */}
        {recordType !== 'daily' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t(`record.form.dateLabel.${recordType}`)}
          </label>
          <DatePicker
            value={visitDate}
            onChange={(v) => { setVisitDate(v); setIsDirty(true); }}
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
              onChange={(v) => { setDischargeDate(v); setIsDirty(true); }}
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
              placeholder={t('record.form.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
              maxLength={700}
              autoComplete="off"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[140px] resize-none"
            />
          </div>
        )}

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
          <>
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">{recordType === 'hospitalization' ? t('record.section.hospitalizationDetail') : t('record.section.visitDetail')}</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.form.description')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <textarea
                name="description"
                placeholder={t('record.form.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onCompositionEnd={(e) => setDescription(e.currentTarget.value)}
                autoComplete="off"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[140px] resize-none"
              />
            </div>

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
                {t('record.form.costWon')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <input
                type="text"
                inputMode={isTouch ? 'none' : 'numeric'}
                pattern="[0-9]*"
                placeholder="0"
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

            {/* 다음 예약일 — 진료만. 입퇴원은 입원~퇴원 타임라인이 핵심이라 다음 예약은 별도 진료 기록으로. */}
            {recordType === 'visit' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('record.field.nextAppointment')} <span className="text-gray-400 font-normal">{t('common.optional')}</span>
              </label>
              <DatePicker
                value={nextAppointmentDate}
                onChange={(v) => { setNextAppointmentDate(v); setIsDirty(true); }}
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

        {/* ── 투약 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
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
              <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  type="search"
                  placeholder={t('record.form.medNamePlaceholder')}
                  value={med.name}
                  onChange={(e) => updateMedication(i, 'name', e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-name-${i}`}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
                <input
                  type="search"
                  placeholder={t('record.form.dosagePlaceholder')}
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  enterKeyHint="next"
                  name={`medication-dosage-${i}`}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white appearance-none [&::-webkit-search-cancel-button]:hidden"
                />
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
                      onChange={(v) => { updateMedication(i, 'start_date', v); setIsDirty(true); }}
                      inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">{t('record.form.endDate')}</label>
                    <DatePicker
                      value={med.end_date}
                      onChange={(v) => { updateMedication(i, 'end_date', v); setIsDirty(true); }}
                      min={med.start_date}
                      inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
                <ColorPicker
                  label={t('record.form.medCalendarColor')}
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
                    {subscribingIdx === i ? t('record.form.alarmTurningOn') : t('record.form.medAlarm', { state: med.alarm_enabled ? 'ON' : 'OFF' })}
                  </button>
                  {/* 알림 ON 인데 브라우저 권한이 'denied' (차단) 면 인라인 안내.
                      DB 에 alarm_enabled=true 는 저장되지만 실제로 푸시 안 옴 →
                      사용자한테 명확히 알려주고 복구 경로(기기 설정) 링크 제공. */}
                  {canUseAlarm && med.alarm_enabled && notifPermission === 'denied' && !isNativeApp() && i === 0 && (
                    <div className="flex items-start gap-1.5 px-2 py-1.5 mt-1 bg-red-50 border border-red-100 rounded-md text-[11px] text-red-600 leading-snug">
                      <BellOff size={11} className="flex-shrink-0 mt-0.5" />
                      <p>
                        {t('record.form.notifBlocked')}
                      </p>
                    </div>
                  )}
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

        {/* ── 첨부 섹션 — 일상은 '오늘을 담은 한 컷' (사진 1장), 그 외는 플랜별 첨부 ── */}
        <>
          <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
            <Paperclip size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800">
              {recordType === 'daily' ? t('record.detail.dailyPhoto') : t('record.form.attachments')}
            </h3>
          </div>

          <div className="space-y-2">
            <FileUploader
              files={files}
              onFilesChange={(newFiles) => {
                const added = newFiles.length > files.length;
                setFiles(newFiles);
                if (added) {
                  setTimeout(() => fileEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);
                }
              }}
              maxFiles={recordType === 'daily' ? 1 : getPlanConfig(getEffectivePlan(profile?.plan)).attachmentsPerRecord}
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
      <ConfirmModal
        open={showAlarmUpgrade}
        icon={<Bell size={16} className="text-blue-500" />}
        title={t('record.form.alarmFeatureTitle')}
        message={
          <>
            <span className="block text-gray-600">
              {!isPWA ? t('record.form.alarmUpsellApp') : t('record.form.alarmUpsellWeb')}
            </span>
            <span className="block text-gray-400 mt-1">{t('record.form.alarmUpsellDesc')}</span>
          </>
        }
        cancelLabel={t('common.close')}
        confirmLabel={t('record.form.viewPlans')}
        onConfirm={() => { setShowAlarmUpgrade(false); router.push('/profile/subscription'); }}
        onCancel={() => setShowAlarmUpgrade(false)}
      />

      <ConfirmModal
        open={showExitConfirm}
        title={t('record.form.leaveTitle')}
        message={t('record.form.leaveMessage')}
        confirmLabel={t('record.form.leave')}
        cancelLabel={t('record.form.keepEditing')}
        variant="danger"
        onConfirm={() => {
          // "나가기" = 작성 포기. draft + 세션 마커 모두 정리 → 다음 진입 시 모달 안 뜸.
          setShowExitConfirm(false);
          clearDraftAndSession();
          guardPushedRef.current = false;
          window.history.go(-2);
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Draft 복원 — 마운트 시 localStorage 에 임시 저장된 내용이 있으면 띄움.
          [불러오기] = 폼에 복원 / [새로 시작] = draft 삭제 후 빈 폼.
          약·첨부 파일은 의도적으로 draft 에 포함 안 했으므로 안내 문구로 분리 처리. */}
      <ConfirmModal
        open={!!pendingDraft}
        title={t('record.form.draftTitle')}
        message={
          <>
            <p>{t('record.form.draftMessage1')}</p>
            <p className="mt-2 text-[10px] text-gray-400">
              {t('record.form.draftMessage2')}
            </p>
          </>
        }
        confirmLabel={t('record.form.draftLoad')}
        cancelLabel={t('record.form.draftNew')}
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
        title={t('record.form.softPromptTitle')}
        icon={<Bell size={16} className="text-orange-500" />}
        bgClassName="bg-orange-50"
        message={
          <>
            <p>{t('record.form.softPromptMsg1')}</p>
            <p className="mt-2 text-[10px] text-gray-400">
              {t('record.form.softPromptMsg2')}
            </p>
          </>
        }
        confirmLabel={t('record.form.allow')}
        cancelLabel={t('record.form.later')}
        onConfirm={handlePushPromptAllow}
        onCancel={handlePushPromptCancel}
      />
    </div>
  );
}
