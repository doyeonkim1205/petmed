import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle OAuth callback manually
  },
});

/**
 * Ensures a valid (non-expired) Supabase session before data queries.
 * If token is expired/expiring, refreshes it automatically.
 * Returns session if valid, null if user needs to re-login.
 */
export async function ensureValidSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);

    if (now >= payload.exp - 60) {
      // Token expired or about to expire — refresh
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return null;
      return data.session;
    }
  } catch {
    // Can't parse token — try refresh anyway
    const { data } = await supabase.auth.refreshSession();
    return data.session;
  }

  return session;
}

// Types for database tables
export interface Profile {
  id: string;
  email: string;
  nickname: string;
  avatar_url?: string;
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
export type RecordType = 'symptom' | 'visit' | 'manual';

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
  next_appointment_date?: string;
  created_at: string;
  updated_at: string;
  pets?: Pet;
  medications?: Medication[];
  record_files?: RecordFile[];
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
  created_at: string;
}

export interface MedicationCheck {
  id: string;
  medication_id: string;
  user_id: string;
  check_date: string;
  checked: boolean;
  checked_at?: string;
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
