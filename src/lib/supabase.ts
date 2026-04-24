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
}

export interface SearchLog {
  id: string;
  user_id: string;
  query: string;
  pet_type: string;
  created_at: string;
}

export interface SavedAnalysis {
  id: string;
  user_id: string;
  query: string;
  pet_type: string;
  articles: any[];
  analysis: any;
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
  created_at: string;
}

// Health Record types
export type RecordType = 'symptom' | 'visit' | 'hospitalization' | 'manual';

export interface HealthRecord {
  id: string;
  user_id: string;
  pet_id: string;
  record_type: RecordType;
  title: string;
  description?: string;
  hospital_name?: string;
  visit_date: string;
  cost?: number;
  ai_summary?: string;
  color?: string;
  discharge_date?: string;
  next_appointment_date?: string;
  next_appointment_color?: string;
  symptom_time?: string;
  weight?: number;
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
  created_at: string;
}

export interface Medication {
  id: string;
  record_id: string;
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
