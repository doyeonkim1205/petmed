'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useMedications() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const addMedication = async (medication: {
    record_id: string;
    name: string;
    dosage?: string;
    start_date: string;
    end_date?: string;
    frequency: string;
    color?: string;
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('medications')
      .insert({ ...medication, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteMedication = async (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  };

  const getTodayMedications = useCallback(async (petId?: string) => {
    if (!user) return [];

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const query = supabase
        .from('medications')
        .select(`
          *,
          health_records!inner (pet_id, pets:pet_id (id, name, type))
        `)
        .eq('user_id', user.id)
        .lte('start_date', today);

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter((med: any) => {
        const endOk = !med.end_date || med.end_date >= today;
        const petOk = !petId || med.health_records?.pet_id === petId;
        return endOk && petOk;
      });

      return filtered;
    } catch (error) {
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

  const toggleCheck = async (medicationId: string, date: string, checked: boolean) => {
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
        }, { onConflict: 'medication_id,check_date' });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('medication_checks')
        .delete()
        .eq('medication_id', medicationId)
        .eq('check_date', date)
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

  return {
    loading,
    addMedication,
    deleteMedication,
    getTodayMedications,
    getChecksForDate,
    toggleCheck,
    getMedicationsByRecordId,
  };
}
