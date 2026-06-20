'use client';

import { useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// 복약/예방 변경 시 홈 위젯이 즉시 재조회하도록 알림 (홈 위젯이 listen).
function notifyScheduleUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('pawdex:schedule-updated'));
}

export function useMedications() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const addMedication = async (medication: {
    record_id?: string | null;       // 진료/입퇴원에 딸린 약이면 연결, 펫 단위 독립 약이면 생략
    pet_id?: string | null;          // 펫 직접 연결 (재구조화 후 기본)
    kind?: 'prescription' | 'supplement' | 'other';
    name: string;
    dosage?: string;
    start_date: string;
    end_date?: string;
    frequency: string;
    color?: string;
    alarm_enabled?: boolean;
    alarm_times?: string[];
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('medications')
      .insert({ ...medication, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    notifyScheduleUpdated();
    return data;
  };

  const updateMedication = async (id: string, updates: {
    name?: string;
    dosage?: string;
    start_date?: string;
    end_date?: string | null;
    frequency?: string;
    color?: string;
    kind?: 'prescription' | 'supplement' | 'other';
    alarm_enabled?: boolean;
    alarm_times?: string[];
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    notifyScheduleUpdated();
  };

  const deleteMedication = async (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    notifyScheduleUpdated();
  };

  const getTodayMedications = useCallback(async (petId?: string, date?: string) => {
    if (!user) return [];

    setLoading(true);
    try {
      const targetDate = date || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      // 펫 단위 직접 연결(pet_id) 기준. 진료기록에 딸린 약도 pet_id 가 채워져 있음(마이그레이션 백필).
      // 펫 단위 독립 약(record_id NULL)도 함께 잡히도록 left join.
      const query = supabase
        .from('medications')
        .select(`
          *,
          pets:pet_id (id, name, type)
        `)
        .eq('user_id', user.id)
        .lte('start_date', targetDate);

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter((med: any) => {
        // If end_date exists, check it; if not, default to 90 days from start_date
        let endOk: boolean;
        if (med.end_date) {
          endOk = med.end_date >= targetDate;
        } else {
          // No end_date: default to 90 days from start_date (same as CalendarView)
          const start = new Date(med.start_date);
          const defaultEnd = new Date(start);
          defaultEnd.setDate(defaultEnd.getDate() + 90);
          endOk = targetDate <= defaultEnd.toISOString().split('T')[0];
        }
        const petOk = !petId || med.pet_id === petId;
        return endOk && petOk;
      });

      return filtered;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'medications', action: 'fetch-today' },
        extra: { userId: user?.id },
      });
      console.error('Error fetching today medications:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getChecksForDate = useCallback(async (date: string) => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('medication_checks')
      .select('*')
      .eq('user_id', user.id)
      .eq('check_date', date);

    if (error) {
      console.error('Error fetching checks:', error);
      return [];
    }
    return data || [];
  }, [user]);

  const toggleCheck = async (medicationId: string, date: string, checked: boolean, doseNumber: number = 0) => {
    if (!user) throw new Error('로그인이 필요합니다');

    if (checked) {
      const { error } = await supabase
        .from('medication_checks')
        .upsert({
          medication_id: medicationId,
          user_id: user.id,
          check_date: date,
          checked: true,
          checked_at: new Date().toISOString(),
          dose_number: doseNumber,
        }, { onConflict: 'medication_id,check_date,dose_number' });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('medication_checks')
        .delete()
        .eq('medication_id', medicationId)
        .eq('check_date', date)
        .eq('dose_number', doseNumber)
        .eq('user_id', user.id);

      if (error) throw error;
    }
  };

  const getMedicationsByRecordId = async (recordId: string) => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('record_id', recordId)
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching medications:', error);
      return [];
    }
    return data || [];
  };

  // 복약 관리 페이지용: 펫의 모든 약(복용중·종료 포함) 최신순.
  const getMedicationsByPet = useCallback(async (petId: string) => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('pet_id', petId)
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching pet medications:', error);
      return [];
    }
    return data || [];
  }, [user]);

  return {
    loading,
    addMedication,
    updateMedication,
    deleteMedication,
    getTodayMedications,
    getChecksForDate,
    toggleCheck,
    getMedicationsByRecordId,
    getMedicationsByPet,
  };
}
