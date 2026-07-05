'use client';

// 검사 수치 추가 v1 — 템플릿 그룹 아코디언 + 체크하면 그 자리에 값 입력(인라인). 바텀시트 없음.
// 영/한 이중 라벨. 값 있는 항목만 저장. TODO: 지난검사 자동선택·결과지 첨부·참고범위·i18n.
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, X, ChevronDown, Check } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { authFetch } from '@/lib/authFetch';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import { useLabTests, LabValueInput } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, LAB_ANALYTES, analyteDisplay, type LabTemplateKey } from '@/lib/labCatalog';

interface CustomAnalyte { key: string; label: string; }

function AddLabInner() {
  const router = useRouter();
  const params = useSearchParams();
  const petId = params.get('pet') || '';
  const { createLabTest } = useLabTests();

  const [testDate, setTestDate] = useState(todayLocalISO());
  const [hospital, setHospital] = useState('');
  const [memo, setMemo] = useState('');
  const [open, setOpen] = useState<Set<LabTemplateKey>>(
    () => new Set(LAB_TEMPLATES.filter((t) => t.defaultOpen && t.key !== 'custom').map((t) => t.key)),
  );
  const [active, setActive] = useState<Set<string>>(new Set());   // 값 입력칸 표시(체크)된 analyte
  const [values, setValues] = useState<Record<string, { raw: string; unit: string }>>({});
  const [customs, setCustoms] = useState<CustomAnalyte[]>([]);
  const [customName, setCustomName] = useState('');
  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHosp, setShowHosp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/recent-hospitals').then(async (r) => { if (r.ok) setHospitalSuggestions(await r.json()); }).catch(() => {});
  }, []);

  const toggle = (k: LabTemplateKey) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const toggleAnalyte = (key: string, unitDefault: string) => {
    const wasOn = active.has(key);
    setActive((prev) => { const n = new Set(prev); if (wasOn) n.delete(key); else n.add(key); return n; });
    setValues((prev) => {
      if (wasOn) { const c = { ...prev }; delete c[key]; return c; }
      return prev[key] ? prev : { ...prev, [key]: { raw: '', unit: unitDefault } };
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

  // 열린 템플릿 순서대로 렌더하되 이미 나온 analyte 는 skip(union dedup) → 같은 수치 중복 방지.
  const sections = useMemo(() => {
    const rendered = new Set<string>();
    const out: { tpl: typeof LAB_TEMPLATES[number]; analytes: typeof LAB_ANALYTES }[] = [];
    for (const tpl of LAB_TEMPLATES) {
      if (tpl.key === 'custom') continue;
      const analytes = LAB_ANALYTES.filter((a) => a.templates.includes(tpl.key) && !rendered.has(a.key));
      analytes.forEach((a) => rendered.add(a.key));
      out.push({ tpl, analytes });
    }
    return out;
  }, []);

  const filledCount = [...active].filter((k) => (values[k]?.raw ?? '').trim() !== '').length;

  const handleSave = async () => {
    if (!petId) { setError('반려동물 정보가 없어요.'); return; }
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
      LAB_ANALYTES.filter((a) => active.has(a.key)).forEach((a) => a.templates.forEach((t) => cats.add(t)));
      if (customs.some((c) => active.has(c.key))) cats.add('custom');
      await createLabTest({ pet_id: petId, test_date: testDate, hospital_name: hospital, categories: [...cats], memo, values: vals });
      if (hospital.trim()) authFetch('/api/recent-hospitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: hospital.trim() }) }).catch(() => {});
      router.replace('/records/labs');
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'labs', action: 'create' } });
      setError('저장에 실패했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  };

  const deleteHosp = (name: string) => {
    setHospitalSuggestions((prev) => prev.filter((h) => h !== name));
    authFetch('/api/recent-hospitals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {});
  };
  const hospMatches = hospitalSuggestions.filter((h) => h.toLowerCase().includes(hospital.toLowerCase()) && h !== hospital);

  // 체크 줄 + 체크 시 인라인 입력칸.
  const AnalyteRow = ({ akey, label, unitDefault, vtype }: { akey: string; label: string; unitDefault: string; vtype?: string }) => {
    const on = active.has(akey);
    return (
      <div>
        <button type="button" onClick={() => toggleAnalyte(akey, unitDefault)} className="w-full flex items-center gap-2 py-1.5 text-left">
          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
            {on && <Check size={11} className="text-white" />}
          </span>
          <span className={`text-[13px] ${on ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{label}</span>
        </button>
        {on && (
          <div className="flex items-center gap-2 pl-6 pb-1.5">
            <input type="text" inputMode={vtype === 'numeric' ? 'decimal' : 'text'} value={values[akey]?.raw ?? ''}
              onChange={(e) => setVal(akey, e.target.value)} placeholder={vtype === 'numeric' ? '값' : (vtype === 'semi_quantitative' ? '+/-' : '')}
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" value={values[akey]?.unit ?? unitDefault} onChange={(e) => setUnit(akey, e.target.value)} placeholder="단위"
              className="w-16 flex-shrink-0 px-2 py-1.5 border border-gray-100 rounded-lg text-[11px] text-gray-500 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-400" />
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
          <h1 className="text-sm font-semibold text-gray-700">검사 추가</h1>
        </header>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-3 space-y-3">
        {/* 병원 / 검사일 — 세로 */}
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

        {/* 템플릿 그룹 아코디언 — 체크 줄 + 인라인 입력 */}
        <div className="space-y-2">
          {sections.map(({ tpl, analytes }) => {
            const isOpen = open.has(tpl.key);
            const cnt = analytes.filter((a) => active.has(a.key)).length;
            return (
              <div key={tpl.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <button type="button" onClick={() => toggle(tpl.key)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                  <span className="text-base">{tpl.emoji}</span>
                  <span className="text-[13px] font-bold text-gray-800 flex-1">{tpl.labelKo}</span>
                  {cnt > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-2">
                    {analytes.map((a) => <AnalyteRow key={a.key} akey={a.key} label={analyteDisplay(a)} unitDefault={a.defaultUnit} vtype={a.valueType} />)}
                  </div>
                )}
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
              {customs.map((c) => <AnalyteRow key={c.key} akey={c.key} label={c.label} unitDefault="" vtype="numeric" />)}
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

        {/* 메모 */}
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

export default function AddLabPage() {
  return <Suspense fallback={<div className="bg-white min-h-full" />}><AddLabInner /></Suspense>;
}
