'use client';

// 검사 수치 추가/수정 공용 폼. petId 만 오면 추가, initial 이 오면 수정.
// dedup 은 '열린 템플릿' 기준(닫힌 템플릿은 수치를 차지하지 않음) → 전해질만 열면 Na 등이 거기 뜸.
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, ChevronDown, Check, Paperclip, Image as ImageIcon, FileText, Sparkles } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { authFetch } from '@/lib/authFetch';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/fileUpload';
import { supabase, type Pet } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import { useLabTests, LabValueInput, LabTestFile } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, LAB_ANALYTES, analyteDisplay, type LabTemplateKey } from '@/lib/labCatalog';
import { ageGroupFor, refDefaultFor, opSymbol } from '@/lib/labRefDefaults';

const ALLOWED_FILE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface CustomAnalyte { key: string; label: string; }
export interface LabFormInitial {
  id: string;
  test_date: string;
  hospital_name: string;
  memo: string;
  values: { analyte_key: string; label: string; value_raw: string; unit: string | null; ref_low?: number | null; ref_high?: number | null; ref_text?: string | null }[];
  files?: LabTestFile[];
  pet_id?: string;
}

// 값 1개의 입력 상태. ref* = 사용자가 결과지 기준으로 적는 참고범위(앱이 판정/자동채움 안 함).
type VEntry = { raw: string; unit: string; refLow: string; refHigh: string; refText: string };
const emptyEntry = (unit = ''): VEntry => ({ raw: '', unit, refLow: '', refHigh: '', refText: '' });

const SEMI_OPTS = ['음성', 'trace', '+', '++', '+++'];
const TEXT_OPTS = ['없음', '소량', '중등도', '다량'];

export function LabTestForm({ petId, initial, backOnSave }: { petId?: string; initial?: LabFormInitial; backOnSave?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const { createLabTest, updateLabTest, getLastAnalyteKeys, insertLabFile, deleteLabFile } = useLabTests();
  const isEdit = !!initial;

  // 결과지 첨부 — 기존 파일(수정 시)·삭제표시·새 파일. 스토리지 업로드는 검사 저장 후.
  const [existingFiles] = useState<LabTestFile[]>(initial?.files ?? []);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [savedPartial, setSavedPartial] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 종·나이 기준 참고범위 자동 채우기용 펫 정보.
  const effectivePetId = petId ?? initial?.pet_id;
  const [petInfo, setPetInfo] = useState<{ type: Pet['type']; birth_date?: string } | null>(null);
  const [refFillNote, setRefFillNote] = useState<string | null>(null);
  useEffect(() => {
    if (!effectivePetId) return;
    supabase.from('pets').select('type, birth_date').eq('id', effectivePetId).single()
      .then(({ data }) => { if (data) setPetInfo(data as { type: Pet['type']; birth_date?: string }); });
  }, [effectivePetId]);

  const [testDate, setTestDate] = useState(initial?.test_date ?? todayLocalISO());
  const [hospital, setHospital] = useState(initial?.hospital_name ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [active, setActive] = useState<Set<string>>(() => new Set((initial?.values ?? []).map((v) => v.analyte_key)));
  const [values, setValues] = useState<Record<string, VEntry>>(() => {
    const m: Record<string, VEntry> = {};
    (initial?.values ?? []).forEach((v) => {
      m[v.analyte_key] = { raw: v.value_raw, unit: v.unit ?? '', refLow: v.ref_low != null ? String(v.ref_low) : '', refHigh: v.ref_high != null ? String(v.ref_high) : '', refText: v.ref_text ?? '' };
    });
    return m;
  });
  // 참고범위 입력칸이 펼쳐진 행 — 값이 있는 수치는 자동으로 펼침.
  const [refOpen, setRefOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    (initial?.values ?? []).forEach((v) => { if (v.ref_low != null || v.ref_high != null || (v.ref_text ?? '').trim()) s.add(v.analyte_key); });
    return s;
  });
  const [customs, setCustoms] = useState<CustomAnalyte[]>(() =>
    (initial?.values ?? []).filter((v) => v.analyte_key.startsWith('CUSTOM:')).map((v) => ({ key: v.analyte_key, label: v.label || v.analyte_key.slice(7) })),
  );
  const [customName, setCustomName] = useState('');
  const [open, setOpen] = useState<Set<LabTemplateKey>>(() => {
    // 기본은 전부 닫힘. 수정 모드에선 값이 있는 수치의 대표 템플릿만 열어둠.
    const s = new Set<LabTemplateKey>();
    (initial?.values ?? []).forEach((v) => { const a = LAB_ANALYTES.find((x) => x.key === v.analyte_key); if (a) s.add(a.templates[0]); });
    return s;
  });
  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHosp, setShowHosp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { authFetch('/api/recent-hospitals').then(async (r) => { if (r.ok) setHospitalSuggestions(await r.json()); }).catch(() => {}); }, []);

  // 추가 모드: 지난 검사에 넣었던 항목을 자동 선택(값은 빈칸). 병원 패널이 보통 반복되니 매번 선택 안 해도 됨.
  useEffect(() => {
    if (isEdit || !petId) return;
    getLastAnalyteKeys(petId).then((items) => {
      if (items.length === 0) return;
      setActive(new Set(items.map((i) => i.analyte_key)));
      setValues(Object.fromEntries(items.map((i) => [i.analyte_key, emptyEntry(i.unit ?? '')])));
      setCustoms(items.filter((i) => i.analyte_key.startsWith('CUSTOM:')).map((i) => ({ key: i.analyte_key, label: i.analyte_key.slice(7) })));
      setOpen((prev) => {
        const s = new Set(prev);
        items.forEach((i) => { const a = LAB_ANALYTES.find((x) => x.key === i.analyte_key); if (a) s.add(a.templates[0]); });
        return s;
      });
    });
  }, [isEdit, petId, getLastAnalyteKeys]);

  const toggle = (k: LabTemplateKey) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const toggleAnalyte = (key: string, unitDefault: string) => {
    const wasOn = active.has(key);
    setActive((prev) => { const n = new Set(prev); if (wasOn) n.delete(key); else n.add(key); return n; });
    setValues((prev) => {
      if (wasOn) { const c = { ...prev }; delete c[key]; return c; }
      return prev[key] ? prev : { ...prev, [key]: emptyEntry(unitDefault) };
    });
  };

  const toggleSectionAll = (analytes: typeof LAB_ANALYTES) => {
    const allOn = analytes.length > 0 && analytes.every((a) => active.has(a.key));
    setActive((prev) => { const n = new Set(prev); analytes.forEach((a) => { if (allOn) n.delete(a.key); else n.add(a.key); }); return n; });
    setValues((prev) => {
      const n = { ...prev };
      analytes.forEach((a) => { if (allOn) delete n[a.key]; else if (!n[a.key]) n[a.key] = emptyEntry(a.defaultUnit); });
      return n;
    });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const key = `CUSTOM:${name}`;
    if (!customs.some((c) => c.key === key)) setCustoms((prev) => [...prev, { key, label: name }]);
    setActive((prev) => new Set(prev).add(key));
    setValues((prev) => (prev[key] ? prev : { ...prev, [key]: emptyEntry('') }));
    setCustomName('');
  };

  const setVal = (key: string, raw: string) => setValues((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyEntry()), raw } }));
  const setUnit = (key: string, unit: string) => setValues((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyEntry()), unit } }));
  const setRef = (key: string, field: 'refLow' | 'refHigh' | 'refText', v: string) => setValues((prev) => {
    const e = prev[key] ?? emptyEntry();
    const next = { ...e, [field]: v };
    if (field === 'refLow' || field === 'refHigh') next.refText = ''; // 숫자 직접 수정 시 한쪽범위 기호(<0.2 등) 해제
    return { ...prev, [key]: next };
  });
  const toggleRef = (key: string) => setRefOpen((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  // 행별 ✕ = 그 참고범위 값 삭제 + 닫힘(접기만 하면 값이 남아 저장되는 혼란 방지).
  const clearRef = (key: string) => {
    setValues((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyEntry()), refLow: '', refHigh: '', refText: '' } }));
    setRefOpen((prev) => { const n = new Set(prev); n.delete(key); return n; });
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const valid = picked.filter((f) => ALLOWED_FILE.includes(f.type));
    if (valid.length < picked.length) setError('사진(JPG/PNG/WebP) 또는 PDF만 첨부할 수 있어요.');
    else setError(null);
    setNewFiles((prev) => [...prev, ...valid]);
    e.target.value = ''; // 같은 파일 재선택 허용
  };
  const removeExisting = (id: string) => setRemovedIds((prev) => new Set(prev).add(id));
  const removeNew = (idx: number) => setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  const visibleExisting = existingFiles.filter((f) => !removedIds.has(f.id));

  // 종·나이 기준 예시 참고범위 자동 채우기 — 활성 항목 중 비어있는 참고범위만 채움(사용자 입력 보존).
  const refGroup = ageGroupFor(petInfo?.birth_date, testDate);
  const applicableKeys = petInfo ? [...active].filter((k) => refDefaultFor(k, petInfo.type, refGroup)) : [];
  const fillDefaults = () => {
    if (!petInfo) return;
    setValues((prev) => {
      const n = { ...prev };
      applicableKeys.forEach((k) => {
        const d = refDefaultFor(k, petInfo.type, refGroup);
        if (!d) return;
        const e = n[k] ?? emptyEntry();
        // 이미 입력한 참고범위는 덮지 않음.
        if ((e.refLow ?? '').trim() || (e.refHigh ?? '').trim() || (e.refText ?? '').trim()) return;
        if ('text' in d) {
          n[k] = { ...e, refText: d.text };
        } else if ('op' in d) {
          const upper = d.op === '<' || d.op === '<=';
          n[k] = { ...e, refLow: upper ? '' : String(d.value), refHigh: upper ? String(d.value) : '', refText: `${opSymbol(d.op)}${d.value}` };
        } else {
          n[k] = { ...e, refLow: String(d.low), refHigh: String(d.high) };
        }
      });
      return n;
    });
    setRefOpen((prev) => { const s = new Set(prev); applicableKeys.forEach((k) => s.add(k)); return s; });
    setRefFillNote(petInfo.birth_date
      ? '기본 참고범위를 불러왔어요. 병원 결과지에 적힌 범위가 다르면 수정해 주세요.'
      : '생년월일이 없어 성체 기준 기본 참고범위를 불러왔어요. 결과지에 적힌 범위가 다르면 수정해 주세요.');
  };

  const finishNavigation = () => {
    sessionStorage.setItem('lab_list_reload', '1');
    if (isEdit) {
      if (backOnSave) { sessionStorage.setItem('lab_updated_id', initial!.id); router.back(); }
      else router.replace(`/records/labs/${initial!.id}`);
    } else {
      router.back();
    }
  };

  // 열린 템플릿 순서대로 dedup — 닫힌 템플릿은 수치를 차지하지 않음.
  const sections = useMemo(() => {
    const rendered = new Set<string>();
    const out: { tpl: typeof LAB_TEMPLATES[number]; analytes: typeof LAB_ANALYTES }[] = [];
    for (const tpl of LAB_TEMPLATES) {
      if (tpl.key === 'custom') continue;
      if (!open.has(tpl.key)) { out.push({ tpl, analytes: [] }); continue; }
      const analytes = LAB_ANALYTES.filter((a) => a.templates.includes(tpl.key) && !rendered.has(a.key));
      analytes.forEach((a) => rendered.add(a.key));
      out.push({ tpl, analytes });
    }
    return out;
  }, [open]);

  const filledCount = [...active].filter((k) => (values[k]?.raw ?? '').trim() !== '').length;

  const handleSave = async () => {
    if (!isEdit && !petId) { setError('반려동물 정보가 없어요.'); return; }
    if (filledCount === 0 && newFiles.length === 0 && visibleExisting.length === 0) { setError('수치를 입력하거나 결과지를 첨부해주세요.'); return; }
    setError(null);
    setSaving(true);
    try {
      const ordered = [...LAB_ANALYTES.filter((a) => active.has(a.key)).map((a) => ({ key: a.key, label: analyteDisplay(a) })),
                       ...customs.filter((c) => active.has(c.key)).map((c) => ({ key: c.key, label: c.label }))];
      const num = (s?: string) => { const f = parseFloat((s ?? '').trim()); return Number.isFinite(f) ? f : null; };
      const vals: LabValueInput[] = ordered
        .filter((i) => (values[i.key]?.raw ?? '').trim())
        .map((i, idx) => {
          const e = values[i.key];
          const a = LAB_ANALYTES.find((x) => x.key === i.key);
          const isNum = !a || a.valueType === 'numeric'; // custom = numeric
          return {
            analyte_key: i.key, label: i.label, value_raw: e.raw, unit: e.unit || null, display_order: idx,
            ref_low: isNum ? num(e.refLow) : null,
            ref_high: isNum ? num(e.refHigh) : null,
            ref_text: (e.refText ?? '').trim() || null, // 한쪽범위 기호(<0.2)·선택형(음성) 모두 보존
          };
        });
      const cats = new Set<string>();
      const openArr = LAB_TEMPLATES.filter((t) => t.key !== 'custom' && open.has(t.key));
      LAB_ANALYTES.filter((a) => active.has(a.key)).forEach((a) => { const sec = openArr.find((t) => a.templates.includes(t.key)); cats.add(sec ? sec.key : a.templates[0]); });
      if (customs.some((c) => active.has(c.key))) cats.add('custom');
      let labId: string;
      if (isEdit) {
        await updateLabTest(initial!.id, { test_date: testDate, hospital_name: hospital, categories: [...cats], memo, values: vals });
        labId = initial!.id;
      } else {
        labId = await createLabTest({ pet_id: petId!, test_date: testDate, hospital_name: hospital, categories: [...cats], memo, values: vals });
      }
      if (hospital.trim()) authFetch('/api/recent-hospitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: hospital.trim() }) }).catch(() => {});

      // 결과지 첨부 — 검사는 이미 저장됨. 파일 실패는 관대 처리(검사 통째로 롤백 X).
      let fileWarning: string | null = null;
      for (const f of existingFiles.filter((x) => removedIds.has(x.id))) {
        try { await deleteLabFile(f.id, f.file_path); } catch { /* 삭제 실패는 조용히 넘어감 */ }
      }
      if (newFiles.length > 0) {
        const usage = await authFetch('/api/storage-usage').then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (usage && !usage.canUpload) {
          fileWarning = '저장용량이 가득 차 결과지 파일은 첨부되지 않았어요. 저장공간을 정리한 뒤 상세에서 다시 첨부해주세요.';
        } else {
          let failed = 0;
          for (const file of newFiles) {
            try {
              const { path } = await uploadFile(file, user!.id, labId);
              await insertLabFile({ lab_test_id: labId, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size });
            } catch (err) { failed++; Sentry.captureException(err, { tags: { feature: 'labs', action: 'file-upload' } }); }
          }
          if (failed > 0) fileWarning = `검사는 저장됐어요. 다만 파일 ${failed}개 업로드에 실패했어요. 상세에서 다시 첨부할 수 있어요.`;
        }
      }

      if (fileWarning) { setSavedPartial(fileWarning); setSaving(false); return; } // 확인 누르면 이동
      finishNavigation();
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'labs', action: isEdit ? 'update' : 'create' } });
      setError('저장에 실패했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  };

  const deleteHosp = (name: string) => {
    setHospitalSuggestions((prev) => prev.filter((h) => h !== name));
    authFetch('/api/recent-hospitals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {});
  };
  const hospMatches = hospitalSuggestions.filter((h) => h.toLowerCase().includes(hospital.toLowerCase()) && h !== hospital);

  // ⚠️ 컴포넌트로 빼면 리렌더마다 remount→포커스 유실 → 인라인 함수.
  const renderRow = (akey: string, label: string, unitDefault: string, vtype?: string) => {
    const on = active.has(akey);
    const hasUnit = unitDefault.trim() !== '';
    const numeric = !vtype || vtype === 'numeric';
    const opts = vtype === 'semi_quantitative' ? SEMI_OPTS : TEXT_OPTS;
    const raw = values[akey]?.raw ?? '';
    return (
      <div key={akey} className="py-1">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => toggleAnalyte(akey, unitDefault)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
              {on && <Check size={11} className="text-white" />}
            </span>
            <span className={`text-[13px] truncate ${on ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{label}</span>
          </button>
          {on && numeric && (
            <>
              <input type="text" inputMode="decimal" value={raw} onChange={(e) => setVal(akey, e.target.value)} placeholder="값"
                className="w-20 flex-shrink-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              {hasUnit && (
                <input type="text" value={values[akey]?.unit ?? unitDefault} onChange={(e) => setUnit(akey, e.target.value)} placeholder="단위"
                  className="w-14 flex-shrink-0 px-2 py-1.5 border border-gray-100 rounded-lg text-[11px] text-gray-500 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-400" />
              )}
            </>
          )}
        </div>
        {/* 참고범위 — 결과지 기준 사용자 입력. 앱은 판정 안 함(정상/위험 표시 없음). */}
        {on && numeric && (
          refOpen.has(akey) ? (
            <div className="pl-6 pt-1 flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 flex-shrink-0">참고범위</span>
              <input type="text" inputMode="decimal" value={values[akey]?.refLow ?? ''} onChange={(e) => setRef(akey, 'refLow', e.target.value)} placeholder="7"
                className="w-12 px-2 py-1 border border-gray-200 rounded-lg text-[12px] text-center bg-white outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-gray-300 text-xs">~</span>
              <input type="text" inputMode="decimal" value={values[akey]?.refHigh ?? ''} onChange={(e) => setRef(akey, 'refHigh', e.target.value)} placeholder="27"
                className="w-12 px-2 py-1 border border-gray-200 rounded-lg text-[12px] text-center bg-white outline-none focus:ring-1 focus:ring-blue-400" />
              {hasUnit && <span className="text-[11px] text-gray-400">{values[akey]?.unit || unitDefault}</span>}
              <button type="button" onClick={() => clearRef(akey)} className="text-gray-300 hover:text-gray-500 ml-auto flex-shrink-0" aria-label="참고범위 지우기"><X size={12} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => toggleRef(akey)} className="ml-6 mt-1 text-[11px] text-blue-500">+ 참고범위 입력</button>
          )
        )}
        {on && !numeric && (
          <div className="pl-6 pt-1 flex flex-wrap items-center gap-1">
            {opts.map((opt) => (
              <button key={opt} type="button" onClick={() => setVal(akey, opt)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${raw === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{opt}</button>
            ))}
            {vtype === 'text' && (
              <input type="text" value={opts.includes(raw) ? '' : raw} onChange={(e) => setVal(akey, e.target.value)} placeholder="직접"
                className="w-20 px-2 py-0.5 border border-gray-200 rounded-full text-[11px] outline-none focus:ring-1 focus:ring-blue-400" />
            )}
          </div>
        )}
        {on && !numeric && (
          refOpen.has(akey) ? (
            <div className="pl-6 pt-1 flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 flex-shrink-0">참고값</span>
              <input type="text" value={values[akey]?.refText ?? ''} onChange={(e) => setRef(akey, 'refText', e.target.value)} placeholder="음성"
                className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-[12px] bg-white outline-none focus:ring-1 focus:ring-blue-400" />
              <button type="button" onClick={() => clearRef(akey)} className="text-gray-300 hover:text-gray-500 ml-auto flex-shrink-0" aria-label="참고값 지우기"><X size={12} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => toggleRef(akey)} className="ml-6 mt-1 text-[11px] text-blue-500">+ 참고값 입력</button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="bg-white min-h-full pb-24">
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-sm font-semibold text-gray-700">{isEdit ? '검사 수정' : '검사 추가'}</h1>
        </header>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-3 space-y-3">
        <div className="space-y-2">
          <div className="relative">
            <label className="text-xs text-gray-400 mb-1 block">병원 <span className="text-gray-300">(선택)</span></label>
            <input type="search" value={hospital}
              onChange={(e) => { setHospital(e.target.value); setShowHosp(true); }}
              onFocus={() => setShowHosp(true)} onBlur={() => setTimeout(() => setShowHosp(false), 150)}
              maxLength={30} placeholder="병원명" autoComplete="off"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none [&::-webkit-search-cancel-button]:hidden" />
            {showHosp && hospMatches.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                {hospMatches.map((name) => (
                  <div key={name} className="flex items-center hover:bg-blue-50 transition-colors">
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setHospital(name); setShowHosp(false); }}
                      className="flex-1 text-left px-3 py-2 text-sm text-gray-700 truncate">{name}</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => deleteHosp(name)}
                      className="px-2.5 py-2 text-gray-300 hover:text-red-400" aria-label="삭제"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">검사일</label>
            <DatePicker value={testDate} onChange={setTestDate} max={todayLocalISO()} inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
        </div>

        {/* 결과지 첨부 — 사진/PDF. 실제 업로드는 저장 시(검사 저장 후). */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">결과지 첨부 <span className="text-gray-300">(선택)</span></label>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={onPickFiles} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 active:bg-gray-50 transition-colors">
            <Paperclip size={15} /> 결과지 사진·PDF 첨부
          </button>
          {(visibleExisting.length > 0 || newFiles.length > 0) && (
            <div className="mt-2 space-y-1.5">
              {visibleExisting.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg">
                  {f.file_type.startsWith('image/') ? <ImageIcon size={14} className="text-gray-400 flex-shrink-0" /> : <FileText size={14} className="text-gray-400 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 text-[12px] text-gray-600 truncate">{f.file_name}</span>
                  <button type="button" onClick={() => removeExisting(f.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0" aria-label="첨부 삭제"><X size={13} /></button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded-lg">
                  {f.type.startsWith('image/') ? <ImageIcon size={14} className="text-blue-400 flex-shrink-0" /> : <FileText size={14} className="text-blue-400 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 text-[12px] text-gray-600 truncate">{f.name}</span>
                  <span className="text-[10px] text-blue-400 flex-shrink-0">새 파일</span>
                  <button type="button" onClick={() => removeNew(i)} className="text-gray-300 hover:text-red-400 flex-shrink-0" aria-label="첨부 삭제"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 pt-1">결과지에 있는 항목만 선택해 입력해 주세요. 값이 입력된 항목만 저장돼요.</p>

        {/* 기본 참고범위 불러오기 — 활성 항목 중 기본값 있는 게 있을 때만. 배너 아닌 조용한 버튼 + 회색 캡션. */}
        {applicableKeys.length > 0 && (
          <div>
            <button type="button" onClick={fillDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 active:bg-gray-50 transition-colors">
              <Sparkles size={13} className="text-indigo-400" /> 기본 참고범위 불러오기
            </button>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              {refFillNote ?? '반려동물의 종과 나이를 기준으로 참고범위를 채워요. 결과지와 다르면 수정해 주세요.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {sections.map(({ tpl, analytes }) => {
            const isOpen = open.has(tpl.key);
            const cnt = LAB_ANALYTES.filter((a) => a.templates.includes(tpl.key) && active.has(a.key)).length;
            const allOn = analytes.length > 0 && analytes.every((a) => active.has(a.key));
            return (
              <div key={tpl.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="w-full flex items-center gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => toggle(tpl.key)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <span className="text-base">{tpl.emoji}</span>
                    <span className="text-[13px] font-bold text-gray-800">{tpl.labelKo}</span>
                    {cnt > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  </button>
                  {isOpen && analytes.length > 0 && (
                    <button type="button" onClick={() => toggleSectionAll(analytes)} className="text-[11px] font-medium text-blue-600 flex-shrink-0 px-1">
                      {allOn ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                  <button type="button" onClick={() => toggle(tpl.key)} className="flex-shrink-0 p-0.5" aria-label="펼치기">
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {isOpen && <div className="px-3 pb-2">{analytes.map((a) => renderRow(a.key, analyteDisplay(a), a.defaultUnit, a.valueType))}</div>}
              </div>
            );
          })}

          {/* 직접 추가 */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-base">➕</span>
              <span className="text-[13px] font-bold text-gray-800 flex-1">직접 추가</span>
            </div>
            <div className="px-3 pb-3">
              {customs.map((c) => renderRow(c.key, c.label, '', 'numeric'))}
              <div className="flex gap-1.5 mt-1">
                <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                  placeholder="항목명 직접 입력 (예: Reticulocyte)" maxLength={24}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={addCustom} className="px-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">추가</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">메모 <span className="text-gray-300">(선택)</span></label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} placeholder="특이사항을 기록해보세요"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none" />
        </div>

        <p className="text-[11px] text-gray-300 leading-relaxed">단위·참고범위는 결과지 기준으로 입력·수정하세요. 병원·장비에 따라 다를 수 있어요. PawDex는 의학적 진단이 아닌 기록·정리 도구예요.</p>
        {error && <p className="text-xs text-red-500">{error}</p>}

        {savedPartial ? (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-[12px] text-amber-700 leading-relaxed">{savedPartial}</p>
            <button onClick={finishNavigation} className="mt-2 w-full h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-sm font-medium">확인</button>
          </div>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : `저장${filledCount > 0 ? ` (${filledCount})` : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
