'use client';

// 검사 수치 추가/수정 공용 폼. petId 만 오면 추가, initial 이 오면 수정.
// dedup 은 '열린 템플릿' 기준(닫힌 템플릿은 수치를 차지하지 않음) → 전해질만 열면 Na 등이 거기 뜸.
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, ChevronDown, Check } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { authFetch } from '@/lib/authFetch';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import { useLabTests, LabValueInput } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, LAB_ANALYTES, analyteDisplay, type LabTemplateKey } from '@/lib/labCatalog';

interface CustomAnalyte { key: string; label: string; }
export interface LabFormInitial {
  id: string;
  test_date: string;
  hospital_name: string;
  memo: string;
  values: { analyte_key: string; label: string; value_raw: string; unit: string | null }[];
}

const SEMI_OPTS = ['음성', 'trace', '+', '++', '+++'];
const TEXT_OPTS = ['없음', '소량', '중등도', '다량'];

export function LabTestForm({ petId, initial }: { petId?: string; initial?: LabFormInitial }) {
  const router = useRouter();
  const { createLabTest, updateLabTest } = useLabTests();
  const isEdit = !!initial;

  const [testDate, setTestDate] = useState(initial?.test_date ?? todayLocalISO());
  const [hospital, setHospital] = useState(initial?.hospital_name ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [active, setActive] = useState<Set<string>>(() => new Set((initial?.values ?? []).map((v) => v.analyte_key)));
  const [values, setValues] = useState<Record<string, { raw: string; unit: string }>>(() => {
    const m: Record<string, { raw: string; unit: string }> = {};
    (initial?.values ?? []).forEach((v) => { m[v.analyte_key] = { raw: v.value_raw, unit: v.unit ?? '' }; });
    return m;
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

  const toggle = (k: LabTemplateKey) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const toggleAnalyte = (key: string, unitDefault: string) => {
    const wasOn = active.has(key);
    setActive((prev) => { const n = new Set(prev); if (wasOn) n.delete(key); else n.add(key); return n; });
    setValues((prev) => {
      if (wasOn) { const c = { ...prev }; delete c[key]; return c; }
      return prev[key] ? prev : { ...prev, [key]: { raw: '', unit: unitDefault } };
    });
  };

  const toggleSectionAll = (analytes: typeof LAB_ANALYTES) => {
    const allOn = analytes.length > 0 && analytes.every((a) => active.has(a.key));
    setActive((prev) => { const n = new Set(prev); analytes.forEach((a) => { if (allOn) n.delete(a.key); else n.add(a.key); }); return n; });
    setValues((prev) => {
      const n = { ...prev };
      analytes.forEach((a) => { if (allOn) delete n[a.key]; else if (!n[a.key]) n[a.key] = { raw: '', unit: a.defaultUnit }; });
      return n;
    });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const key = `CUSTOM:${name}`;
    if (!customs.some((c) => c.key === key)) setCustoms((prev) => [...prev, { key, label: name }]);
    setActive((prev) => new Set(prev).add(key));
    setValues((prev) => (prev[key] ? prev : { ...prev, [key]: { raw: '', unit: '' } }));
    setCustomName('');
  };

  const setVal = (key: string, raw: string) => setValues((prev) => ({ ...prev, [key]: { raw, unit: prev[key]?.unit ?? '' } }));
  const setUnit = (key: string, unit: string) => setValues((prev) => ({ ...prev, [key]: { raw: prev[key]?.raw ?? '', unit } }));

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
    if (filledCount === 0) { setError('수치를 하나 이상 입력해주세요.'); return; }
    setError(null);
    setSaving(true);
    try {
      const ordered = [...LAB_ANALYTES.filter((a) => active.has(a.key)).map((a) => ({ key: a.key, label: analyteDisplay(a) })),
                       ...customs.filter((c) => active.has(c.key)).map((c) => ({ key: c.key, label: c.label }))];
      const vals: LabValueInput[] = ordered
        .filter((i) => (values[i.key]?.raw ?? '').trim())
        .map((i, idx) => ({ analyte_key: i.key, label: i.label, value_raw: values[i.key].raw, unit: values[i.key].unit || null, display_order: idx }));
      const cats = new Set<string>();
      const openArr = LAB_TEMPLATES.filter((t) => t.key !== 'custom' && open.has(t.key));
      LAB_ANALYTES.filter((a) => active.has(a.key)).forEach((a) => { const sec = openArr.find((t) => a.templates.includes(t.key)); cats.add(sec ? sec.key : a.templates[0]); });
      if (customs.some((c) => active.has(c.key))) cats.add('custom');
      if (isEdit) {
        await updateLabTest(initial!.id, { test_date: testDate, hospital_name: hospital, categories: [...cats], memo, values: vals });
      } else {
        await createLabTest({ pet_id: petId!, test_date: testDate, hospital_name: hospital, categories: [...cats], memo, values: vals });
      }
      if (hospital.trim()) authFetch('/api/recent-hospitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: hospital.trim() }) }).catch(() => {});
      router.replace(isEdit ? `/records/labs/${initial!.id}` : '/records/labs');
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

        <p className="text-[11px] text-gray-400 pt-1">결과지에 있는 수치를 체크하면 값 입력칸이 생겨요. 값 넣은 항목만 저장돼요.</p>

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
                      {allOn ? '해제' : '전체'}
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

        <p className="text-[11px] text-gray-300 leading-relaxed">단위는 결과지 기준으로 수정할 수 있어요. PawDex는 의학적 진단이 아닌 기록·정리 도구예요.</p>
        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm disabled:opacity-50 transition-colors">
          {saving ? '저장 중...' : `저장${filledCount > 0 ? ` (${filledCount})` : ''}`}
        </button>
      </div>
    </div>
  );
}
