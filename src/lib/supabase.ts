import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export interface Profile {
  id: string;
  email: string;
  nickname: string;
  avatar_url?: string;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  category: 'boast' | 'info';
  title: string;
  content: string;
  image_url?: string;
  likes: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
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
