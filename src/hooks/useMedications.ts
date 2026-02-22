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

  const updateMedication = async (id: string, updates: {
    name?: string;
    dosage?: string;
    start_date?: string;
    end_date?: string | null;
    frequency?: string;
    color?: string;
  }) => {
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
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

  const getTodayMedications = useCallback(async (petId?: string, date?: string) => {
    if (!user) return [];

    setLoading(true);
    try {
      const targetDate = date || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      const query = supabase
        .from('medications')
        .select(`
          *,
          health_records!inner (pet_id, pets:pet_id (id, name, type))
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

  return {
    loading,
    addMedication,
    updateMedication,
    deleteMedication,
    getTodayMedications,
    getChecksForDate,
    toggleCheck,
    getMedicationsByRecordId,
  };
}
