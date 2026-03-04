'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, HealthRecord } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLog';
import { getPlanConfig } from '@/lib/plans';

export function useHealthRecords(petId?: string) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // First try with joins
      let query = supabase
        .from('health_records')
        .select(`
          *,
          pets:pet_id (id, name, type),
          medications (*),
          record_files (*)
        `)
        .eq('user_id', userId)
        .order('visit_date', { ascending: false });

      if (petId) {
        query = query.eq('pet_id', petId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        // If join query fails, try simple query without joins
        console.error('Join query failed, trying simple query:', queryError);
        let fallback = supabase
          .from('health_records')
          .select('*')
          .eq('user_id', userId)
          .order('visit_date', { ascending: false });
        if (petId) {
          fallback = fallback.eq('pet_id', petId);
        }
        const { data: simpleData, error: simpleError } = await fallback;

        if (simpleError) throw simpleError;
        setRecords((simpleData || []).map(r => ({ ...r, medications: [], record_files: [] })));
        return;
      }

      setRecords(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '기록을 불러오는데 실패했습니다';
      console.error('Error fetching records:', err);
      setError(message);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [userId, petId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const createRecord = async (record: {
    pet_id: string;
    record_type: string;
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
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    // Check record limit based on plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();
    const config = getPlanConfig(profile?.plan || 'free');
    if (config.maxRecords > 0) {
      const { count } = await supabase
        .from('health_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if ((count || 0) >= config.maxRecords) {
        const plan = profile?.plan || 'free';
        const suffix = plan === 'premium' ? ' 추가 용량이 필요하시면 문의해 주세요.' : ' 업그레이드하여 더 많은 기록을 추가하세요.';
        throw new Error(`기록 한도(${config.maxRecords}개)에 도달했습니다.${suffix}`);
      }
    }

    const { data, error } = await supabase
      .from('health_records')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    logActivity(user.id, 'record.create', { resourceType: 'health_record', resourceId: data.id });
    await fetchRecords();
    return data;
  };

  const updateRecord = async (id: string, updates: Partial<HealthRecord>) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('health_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    await fetchRecords();
  };

  const deleteRecord = async (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('health_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    logActivity(user.id, 'record.delete', { resourceType: 'health_record', resourceId: id });
    await fetchRecords();
  };

  const deleteRecords = async (ids: string[]) => {
    if (!user) throw new Error('로그인이 필요합니다');
    if (ids.length === 0) return;

    const { error } = await supabase
      .from('health_records')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) throw error;
    logActivity(user.id, 'record.bulk_delete', { resourceType: 'health_record', details: { count: ids.length } });
    await fetchRecords();
  };

  const getRecord = async (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('health_records')
      .select(`
        *,
        pets:pet_id (id, name, type),
        medications (*),
        record_files (*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data as HealthRecord;
  };

  return { records, loading, error, fetchRecords, createRecord, updateRecord, deleteRecord, deleteRecords, getRecord };
}
