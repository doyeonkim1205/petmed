import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Bypass navigator.locks (Web Locks API) to prevent deadlocks
// supabase-js uses navigator.locks internally for cross-tab session coordination.
// In Next.js SPA navigation, locks can deadlock causing getSession() and all
// queries to hang forever. Using a simple pass-through lock prevents this.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return await fn();
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
});

// Types for database tables
export type UserPlan = 'free' | 'plus';

export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  nickname: string;
  avatar_url?: string;
  plan: UserPlan;
  role: UserRole;
  created_at: string;
  // 푸시 알림 수신 의사. null = 미결정 (신규 or 아직 토글 안 건드린 유저),
  // true = 마이페이지에서 ON, false = 마이페이지에서 명시적 OFF.
  // auto-resubscribe 로직이 false 면 스킵해서 사용자 의사 존중.
  is_push_enabled?: boolean | null;
  // 선호 언어 (계정 동기화). null = 미설정 → 쿠키/navigator.language 로 추정.
  // 'ko' | 'en' (i18n locales 와 일치). 로그인 시 이 값으로 NEXT_LOCALE 쿠키 seed.
  preferred_language?: 'ko' | 'en' | null;
  // 서비스 지역 (언어와 별개 축). 통화·단위·지도 provider 등 지역 기본값 결정.
  // null = 미설정(레거시/신규). RegionSync 가 기기 타임존으로 최초 추정, 설정에서 변경 가능.
  market_region?: 'KR' | 'US' | null;
  market_region_source?: 'legacy_default' | 'timezone_inferred' | 'user_selected' | null;
  // 일일/월 한도 리셋 기준 타임존 (IANA, 예: 'America/New_York'). null = 미설정 → 서버는 'Asia/Seoul'(KST) 폴백.
  quota_timezone?: string | null;
}

export type SearchLogKind = 'symptom' | 'symptom_refine' | 'symptom_photo' | 'disease';

export interface SearchLog {
  id: string;
  user_id: string;
  query: string;
  pet_type: string;
  kind: SearchLogKind;
  result_summary?: {
    input_type?: 'text' | 'photo' | 'photo_with_text';
    main_category?: string;
    ai_confidence?: 'low' | 'medium' | 'high';
    is_valid_photo?: boolean;
  } | null;
  created_at: string;
}

export type SavedAnalysisKind = 'paper' | 'symptom_photo';

export interface SavedAnalysis {
  id: string;
  user_id: string;
  query: string;
  pet_type: string;
  articles: any[];
  analysis: any;
  kind: SavedAnalysisKind;
  created_at: string;
  saved_papers?: SavedPaper[];
}

export interface SavedPaper {
  id: string;
  user_id: string;
  analysis_id: string;
  query: string;
  pet_type: string;
  pmid: string;
  title: string;
  title_ko?: string;
  summary?: string;
  journal?: string;
  pub_date?: string;
  abstract?: string;
  created_at: string;
}

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  type: 'dog' | 'cat';
  breed?: string;
  birth_date?: string;
  // AI 증상 분석 컨텍스트 (2026-05 추가).
  // 모두 NULL 허용 — 기존 펫은 미입력 상태로 유지되며 사용자가 점진적으로 채움.
  sex?: 'male' | 'female' | null;
  neutered?: boolean | null;
  weight?: number | null;                   // kg
  chronic_conditions?: string[] | null;     // 만성질환 목록 (예: ['신부전', '관절염'])
  created_at: string;
}

// Health Record types
export type RecordType = 'symptom' | 'visit' | 'hospitalization' | 'manual' | 'daily';

export type DailySubKind = 'meal' | 'hydration' | 'walk' | 'poop' | 'mood' | 'other';

export interface DailySubEntry {
  sub_kind: DailySubKind;
  time?: string;
  memo?: string;
}

export interface HealthRecord {
  id: string;
  user_id: string;
  pet_id: string;
  record_type: RecordType;
  title: string;
  description?: string;
  hospital_name?: string;
  visit_date: string;
  // ⚠️ DB는 numeric — Supabase가 문자열로 반환하므로 숫자로 쓸 땐 Number()로 감쌀 것.
  cost?: number;
  // 이 기록 금액(cost)의 통화. 생성 시 지역 기본값을 복사(표시 때 언어/타임존으로 재추론 금지).
  currency?: 'KRW' | 'USD' | null;
  ai_summary?: string;
  color?: string;
  discharge_date?: string;
  next_appointment_date?: string;
  next_appointment_color?: string;
  next_appointment_reason?: string;
  symptom_time?: string;
  weight?: number;
  sub_entries?: DailySubEntry[] | null;
  created_at: string;
  updated_at: string;
  pets?: Pet;
  medications?: Medication[];
  record_files?: RecordFile[];
}

export interface WeightLog {
  id: string;
  user_id: string;
  pet_id: string;
  weight: number;
  measured_at: string;
  memo?: string | null;
  created_at: string;
}

// 대소변 기록 (배변/배뇨)
export type ExcretionKind = 'poop' | 'pee';
export interface ExcretionLog {
  id: string;
  user_id: string;
  pet_id: string;
  kind: ExcretionKind;
  condition: string;          // 상태 코드 (kind 별)
  amount?: string | null;     // less|normal|more
  color?: string | null;      // 대변 색 (brown|black|red|yellow|gray)
  memo?: string | null;
  measured_at: string;        // ISO timestamp (시각 포함)
  created_at: string;
}

// 복약 종류: 처방약 / 영양제 / 기타
export type MedicationKind = 'prescription' | 'supplement' | 'other';

export interface Medication {
  id: string;
  record_id?: string | null;   // 진료/입퇴원 기록에 딸린 약이면 연결, 펫 단위 독립 약이면 null
  pet_id?: string | null;      // 펫 직접 연결 (재구조화 후 기본)
  kind?: MedicationKind;       // 처방약(기본) / 영양제 / 기타
  user_id: string;
  name: string;
  dosage?: string;
  start_date: string;
  end_date?: string;
  frequency: string;
  color?: string;
  alarm_enabled?: boolean;
  alarm_times?: string[];
  created_at: string;
}

export interface MedicationCheck {
  id: string;
  medication_id: string;
  user_id: string;
  check_date: string;
  checked: boolean;
  checked_at?: string;
  dose_number: number;
}

export interface RecordFile {
  id: string;
  record_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  ai_analysis?: string;
  created_at: string;
}

// 예방 관리(Preventive Care) — 백신 + 정기 예방약(심장사상충·외부기생충·내부구충).
export type PreventiveCategory =
  | 'heartworm'         // 심장사상충
  | 'external_parasite' // 외부기생충(벼룩·진드기)
  | 'internal_worm'     // 내부구충
  | 'vaccine'           // 종합백신
  | 'rabies'            // 광견병
  | 'health_check'      // 정기 건강검진
  | 'other';            // 기타

export interface PreventiveCare {
  id: string;
  user_id: string;
  pet_id: string;
  category: PreventiveCategory;
  name: string;                       // 제품/항목명 (예: 하트가드)
  last_done_date: string;             // 마지막 시행일 (YYYY-MM-DD)
  interval_unit: 'month' | 'year';    // 주기 단위
  interval_value: number;             // 주기 값 (월1회=1, 3개월=3, 연1회=1)
  next_due_date: string;              // 다음 예정일 (last_done + interval)
  alarm_enabled: boolean;             // 예정일 D-3·당일 알림 (Plus)
  memo?: string | null;
  created_at: string;
  pets?: { id: string; name: string; type: 'dog' | 'cat' } | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: UserPlan;
  status: 'active' | 'canceled' | 'expired';
  toss_customer_key?: string;
  toss_billing_key?: string;
  period_start: string;
  period_end: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  toss_payment_key: string;
  toss_order_id: string;
  amount: number;
  status: 'done' | 'canceled' | 'refunded';
  receipt_url?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}
