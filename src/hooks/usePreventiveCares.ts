'use client';

import { useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { PreventiveCare, PreventiveCategory } from '@/lib/supabase';
import { addInterval } from '@/lib/preventiveCare';

// 예방/복약 변경 시 홈 위젯이 즉시 재조회하도록 알림 (홈 위젯이 listen).
function notifyScheduleUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('pawdex:schedule-updated'));
}

export function usePreventiveCares() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // 펫의 모든 예방 항목 — 다음 예정일 빠른 순.
  const getByPet = useCallback(async (petId: string): Promise<PreventiveCare[]> => {
    if (!user) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('preventive_cares')
        .select('*')
        .eq('pet_id', petId)
        .eq('user_id', user.id)
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return (data as PreventiveCare[]) || [];
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'preventive', action: 'get-by-pet' }, extra: { userId: user?.id } });
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 홈 위젯용 — 유저의 모든 펫 예방 항목 중 임박/지난 순. 펫 이름 포함.
  const getUpcoming = useCallback(async (): Promise<PreventiveCare[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('preventive_cares')
        .select('*, pets:pet_id (id, name, type)')
        .eq('user_id', user.id)
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return (data as PreventiveCare[]) || [];
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'preventive', action: 'get-upcoming' }, extra: { userId: user?.id } });
      return [];
    }
  }, [user]);

  const addCare = async (care: {
    pet_id: string;
    category: PreventiveCategory;
    name?: string;
    last_done_date: string;
    interval_unit: 'month' | 'year';
    interval_value: number;
    alarm_enabled?: boolean;
    memo?: string;
  }): Promise<PreventiveCare> => {
    if (!user) throw new Error('로그인이 필요합니다');
    const next_due_date = addInterval(care.last_done_date, care.interval_unit, care.interval_value);
    const { data, error } = await supabase
      .from('preventive_cares')
      .insert({ ...care, name: care.name ?? '', next_due_date, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    notifyScheduleUpdated();
    return data as PreventiveCare;
  };

  const updateCare = async (id: string, updates: Partial<{
    category: PreventiveCategory;
    name: string;
    last_done_date: string;
    interval_unit: 'month' | 'year';
    interval_value: number;
    alarm_enabled: boolean;
    memo: string;
  }>) => {
    if (!user) throw new Error('로그인이 필요합니다');
    // last_done_date 나 주기가 바뀌면 next_due_date 재계산.
    const patch: Record<string, unknown> = { ...updates };
    if (updates.last_done_date || updates.interval_unit || updates.interval_value) {
      // 변경 후 값으로 다시 계산하려면 현재 레코드 필요 → 호출부에서 완전한 값 전달.
      const { data: cur } = await supabase
        .from('preventive_cares')
        .select('last_done_date, interval_unit, interval_value')
        .eq('id', id).eq('user_id', user.id).single();
      const last = updates.last_done_date ?? cur?.last_done_date;
      const unit = (updates.interval_unit ?? cur?.interval_unit) as 'month' | 'year';
      const val = updates.interval_value ?? cur?.interval_value;
      if (last && unit && val) patch.next_due_date = addInterval(last, unit, val);
    }
    const { error } = await supabase
      .from('preventive_cares')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    notifyScheduleUpdated();
  };

  // "완료" — 시행 완료 처리. 마지막 시행일=완료일(기본 오늘), 다음 예정일 주기만큼 롤.
  const markDone = async (id: string, doneDate: string, interval_unit: 'month' | 'year', interval_value: number) => {
    if (!user) throw new Error('로그인이 필요합니다');
    const next_due_date = addInterval(doneDate, interval_unit, interval_value);
    const { error } = await supabase
      .from('preventive_cares')
      .update({ last_done_date: doneDate, next_due_date })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    notifyScheduleUpdated();
  };

  const deleteCare = async (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다');
    const { error } = await supabase
      .from('preventive_cares')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    notifyScheduleUpdated();
  };

  return { loading, getByPet, getUpcoming, addCare, updateCare, markDone, deleteCare };
}
