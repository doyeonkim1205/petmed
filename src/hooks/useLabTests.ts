'use client';

import { useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLog';
import { parseNumeric } from '@/lib/labCatalog';
import { deleteFile } from '@/services/fileUpload';

// 검사 수치 — 검사 1건(lab_tests) 안에 수치 여러 개(lab_values).
export interface LabValueInput {
  analyte_key: string;
  label: string;
  value_raw: string;
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  ref_text?: string | null;
  display_order?: number;
}

export interface LabValue extends LabValueInput {
  id: string;
  lab_test_id: string;
  value_numeric: number | null;
  created_at: string;
}

export interface LabTestFile {
  id: string;
  lab_test_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface LabTest {
  id: string;
  user_id: string;
  pet_id: string;
  record_id?: string | null;
  test_date: string;      // YYYY-MM-DD
  hospital_name?: string | null;
  categories: string[];   // 선택한 템플릿 key
  memo?: string | null;
  created_at: string;
  updated_at: string;
  lab_values?: LabValue[];
  lab_test_files?: LabTestFile[];
}

export function useLabTests() {
  const { user } = useAuth();

  // 목록 — 펫의 검사 1건들(최신순) + 각 건의 수치 동봉(요약·상세 겸용).
  const getLabTests = useCallback(async (petId: string): Promise<LabTest[]> => {
    if (!user || !petId) return [];
    const { data, error } = await supabase
      .from('lab_tests')
      .select('*, lab_values(*), lab_test_files(id)')
      .eq('user_id', user.id)
      .eq('pet_id', petId)
      .order('test_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      Sentry.captureException(error, { tags: { feature: 'labs', action: 'list' } });
      return [];
    }
    return (data || []) as LabTest[];
  }, [user]);

  const getLabTest = useCallback(async (id: string): Promise<LabTest | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('lab_tests')
      .select('*, lab_values(*), lab_test_files(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error) {
      Sentry.captureException(error, { tags: { feature: 'labs', action: 'get' } });
      return null;
    }
    return data as LabTest;
  }, [user]);

  // 저장 규칙: value_raw 가 비어있는 항목은 저장하지 않음(호출부가 필터). value_numeric 은 파싱해서 채움.
  const createLabTest = async (payload: {
    pet_id: string;
    record_id?: string | null;
    test_date: string;
    hospital_name?: string | null;
    categories: string[];
    memo?: string | null;
    values: LabValueInput[];
  }): Promise<string> => {
    if (!user) throw new Error('로그인이 필요합니다');
    const { data: test, error } = await supabase
      .from('lab_tests')
      .insert({
        user_id: user.id,
        pet_id: payload.pet_id,
        record_id: payload.record_id ?? null,
        test_date: payload.test_date,
        hospital_name: payload.hospital_name?.trim() || null,
        categories: payload.categories,
        memo: payload.memo?.trim() || null,
      })
      .select('id')
      .single();
    if (error) throw error;

    const rows = payload.values
      .filter((v) => v.value_raw.trim() !== '')
      .map((v, i) => ({
        lab_test_id: test.id,
        analyte_key: v.analyte_key,
        label: v.label,
        value_raw: v.value_raw.trim(),
        value_numeric: parseNumeric(v.value_raw),
        unit: v.unit?.trim() || null,
        ref_low: v.ref_low ?? null,
        ref_high: v.ref_high ?? null,
        ref_text: v.ref_text?.trim() || null,
        display_order: v.display_order ?? i,
      }));
    if (rows.length > 0) {
      const { error: vErr } = await supabase.from('lab_values').insert(rows);
      if (vErr) throw vErr;
    }
    logActivity(user.id, 'lab.create', { resourceType: 'lab_test', resourceId: test.id, details: { valueCount: rows.length } });
    return test.id;
  };

  // 수정: 검사 메타 업데이트 + 수치는 전량 교체(간단·안전). 빈 값은 저장 안 함.
  const updateLabTest = async (id: string, payload: {
    test_date: string;
    hospital_name?: string | null;
    categories: string[];
    memo?: string | null;
    values: LabValueInput[];
  }): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다');
    const { error } = await supabase
      .from('lab_tests')
      .update({
        test_date: payload.test_date,
        hospital_name: payload.hospital_name?.trim() || null,
        categories: payload.categories,
        memo: payload.memo?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;

    // 기존 수치 삭제 후 재삽입(값 비운 항목=삭제 규칙을 단순하게 구현).
    await supabase.from('lab_values').delete().eq('lab_test_id', id);
    const rows = payload.values
      .filter((v) => v.value_raw.trim() !== '')
      .map((v, i) => ({
        lab_test_id: id,
        analyte_key: v.analyte_key,
        label: v.label,
        value_raw: v.value_raw.trim(),
        value_numeric: parseNumeric(v.value_raw),
        unit: v.unit?.trim() || null,
        ref_low: v.ref_low ?? null,
        ref_high: v.ref_high ?? null,
        ref_text: v.ref_text?.trim() || null,
        display_order: v.display_order ?? i,
      }));
    if (rows.length > 0) {
      const { error: vErr } = await supabase.from('lab_values').insert(rows);
      if (vErr) throw vErr;
    }
    logActivity(user.id, 'lab.update', { resourceType: 'lab_test', resourceId: id });
  };

  const deleteLabTest = async (id: string): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다');
    const { error } = await supabase.from('lab_tests').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    logActivity(user.id, 'lab.delete', { resourceType: 'lab_test', resourceId: id });
  };

  // 특정 수치의 추이 — 같은 analyte_key + 같은 unit 만 이어 그림(단위 혼재 방지).
  const getAnalyteTrend = useCallback(async (petId: string, analyteKey: string): Promise<{ date: string; value: number; unit: string; refLow: number | null; refHigh: number | null }[]> => {
    if (!user || !petId) return [];
    const { data, error } = await supabase
      .from('lab_values')
      .select('value_numeric, unit, ref_low, ref_high, lab_tests!inner(test_date, pet_id, user_id)')
      .eq('analyte_key', analyteKey)
      .eq('lab_tests.pet_id', petId)
      .eq('lab_tests.user_id', user.id)
      .not('value_numeric', 'is', null);
    if (error) {
      Sentry.captureException(error, { tags: { feature: 'labs', action: 'trend' } });
      return [];
    }
    type Row = { value_numeric: number; unit: string | null; ref_low: number | null; ref_high: number | null; lab_tests: { test_date: string } };
    return ((data || []) as unknown as Row[])
      .map((r) => ({ date: r.lab_tests.test_date, value: Number(r.value_numeric), unit: r.unit || '', refLow: r.ref_low ?? null, refHigh: r.ref_high ?? null }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [user]);

  // 지난(가장 최근) 검사에 넣었던 수치 항목 — 추가 시 자동 선택용(값은 안 가져옴).
  const getLastAnalyteKeys = useCallback(async (petId: string): Promise<{ analyte_key: string; unit: string | null; ref_low: number | null; ref_high: number | null; ref_text: string | null }[]> => {
    if (!user || !petId) return [];
    const { data: last } = await supabase
      .from('lab_tests')
      .select('id')
      .eq('user_id', user.id).eq('pet_id', petId)
      .order('test_date', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!last) return [];
    const { data: vals } = await supabase
      .from('lab_values')
      .select('analyte_key, unit, display_order, ref_low, ref_high, ref_text')
      .eq('lab_test_id', last.id)
      .order('display_order', { ascending: true });
    type Row = { analyte_key: string; unit: string | null; ref_low: number | null; ref_high: number | null; ref_text: string | null };
    return (vals || []).map((v: Row) => ({ analyte_key: v.analyte_key, unit: v.unit, ref_low: v.ref_low ?? null, ref_high: v.ref_high ?? null, ref_text: v.ref_text ?? null }));
  }, [user]);

  // ─── 결과지 첨부 (lab_test_files) — 스토리지는 medical-files 버킷 재사용, DB만 분리 ───
  const getLabFiles = useCallback(async (labTestId: string): Promise<LabTestFile[]> => {
    if (!user || !labTestId) return [];
    const { data, error } = await supabase
      .from('lab_test_files')
      .select('*')
      .eq('lab_test_id', labTestId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) { Sentry.captureException(error, { tags: { feature: 'labs', action: 'files-list' } }); return []; }
    return (data || []) as LabTestFile[];
  }, [user]);

  const insertLabFile = async (row: { lab_test_id: string; file_name: string; file_path: string; file_type: string; file_size: number }): Promise<LabTestFile> => {
    if (!user) throw new Error('로그인이 필요합니다');
    const { data, error } = await supabase
      .from('lab_test_files')
      .insert({ ...row, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    logActivity(user.id, 'lab.file_upload', { resourceType: 'lab_test_file', resourceId: row.lab_test_id, details: { fileName: row.file_name, fileSize: row.file_size } });
    return data as LabTestFile;
  };

  const getFileUrl = useCallback(async (path: string): Promise<string> => {
    const { data } = await supabase.storage.from('medical-files').createSignedUrl(path, 3600);
    return data?.signedUrl ?? '';
  }, []);

  const deleteLabFile = async (id: string, filePath: string): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다');
    await deleteFile(filePath, user.id).catch(() => {}); // 스토리지 제거 실패해도 DB row 는 지움
    const { error } = await supabase.from('lab_test_files').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    logActivity(user.id, 'lab.file_delete', { resourceType: 'lab_test_file', resourceId: id });
  };

  return { getLabTests, getLabTest, createLabTest, updateLabTest, deleteLabTest, getAnalyteTrend, getLastAnalyteKeys, getLabFiles, insertLabFile, deleteLabFile, getFileUrl };
}
