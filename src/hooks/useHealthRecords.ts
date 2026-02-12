'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, HealthRecord } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useHealthRecords(petId?: string) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userId = user?.id;

  const fetchRecords = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
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

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
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
    next_appointment_date?: string;
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('health_records')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
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

  return { records, loading, fetchRecords, createRecord, updateRecord, deleteRecord, getRecord };
}
