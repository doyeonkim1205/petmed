'use client';

// 검사 수치 추가 v1 — 바텀시트 체크박스로 수치 선택(영/한 이중 라벨) + 평탄 입력 리스트 + 직접추가.
// TODO: 결과지 첨부·참고범위 입력·i18n 은 다음 단계.
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, X, Plus } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { authFetch } from '@/lib/authFetch';
import { DatePicker } from '@/components/ui/DatePicker';
import { FilterSheet } from '@/components/records/FilterSheet';
import { todayLocalISO } from '@/lib/date';
import { useLabTests, LabValueInput } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, LAB_ANALYTES, analyteDisplay } from '@/lib/labCatalog';

interface CustomAnalyte { key: string; label: string; unit: string; }

function AddLabInner() {
  const router = useRouter();
  const params = useSearchParams();
  const petId = params.get('pet') || '';
  const { createLabTest } = useLabTests();

  const [testDate, setTestDate] = useState(todayLocalISO());
  const [hospital, setHospital] = useState('');
  const [memo, setMemo] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set());               // 입력할 수치(체크된 것)
  const [values, setValues] = useState<Record<string, { raw: string; unit: string }>>({});
  const [customs, setCustoms] = useState<CustomAnalyte[]>([]);
  const [customName, setCustomName] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [hospitalSuggestions, setHospitalSuggestions] = useState<string[]>([]);
  const [showHosp, setShowHosp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/recent-hospitals').then(async (r) => { if (r.ok) setHospitalSuggestions(await r.json()); }).catch(() => {});
  }, []);

  const toggleAnalyte = (key: string, unitDefault: string) => {
    const wasOn = active.has(key);
    setActive((prev) => { const next = new Set(prev); if (wasOn) next.delete(key); else next.add(key); return next; });
    setValues((prev) => {
      if (wasOn) { const c = { ...prev }; delete c[key]; return c; }
      return prev[key] ? prev : { ...prev, [key]: { raw: '', unit: unitDefault } };
    });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const key = `CUSTOM:${name}`;
    if (!customs.some((c) => c.key === key)) setCustoms((prev) => [...prev, { key, label: name, unit: '' }]);
    setActive((prev) => new Set(prev).add(key));
    setValues((prev) => (prev[key] ? prev : { ...prev, [key]: { raw: '', unit: '' } }));
    setCustomName('');
  };

  const setVal = (key: string, raw: string) => setValues((prev) => ({ ...prev, [key]: { raw, unit: prev[key]?.unit ?? '' } }));
  const setUnit = (key: string, unit: string) => setValues((prev) => ({ ...prev, [key]: { raw: prev[key]?.raw ?? '', unit } }));

  // 입력 리스트 — 카탈로그 순서 + 커스텀. 체크된 것만.
  const inputList = useMemo(() => {
    const cat = LAB_ANALYTES.filter((a) => active.has(a.key)).map((a) => ({ key: a.key, label: analyteDisplay(a), valueType: a.valueType }));
    const cus = customs.filter((c) => active.has(c.key)).map((c) => ({ key: c.key, label: c.label, valueType: 'numeric' as const }));
    return [...cat, ...cus];
  }, [active, customs]);

  const filledCount = inputList.filter((i) => (values[i.key]?.raw ?? '').trim() !== '').length;

  const handleSave = async () => {
    if (!petId) { setError('반려동물 정보가 없어요.'); return; }
    if (filledCount === 0) { setError('수치를 하나 이상 입력해주세요.'); return; }
    setError(null);
    setSaving(true);
    try {
      const vals: LabValueInput[] = inputList
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

  const deleteHosp = async (name: string) => {
    setHospitalSuggestions((prev) => prev.filter((h) => h !== name));
    authFetch('/api/recent-hospitals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => {});
  };

  const hospMatches = hospitalSuggestions.filter((h) => h.toLowerCase().includes(hospital.toLowerCase()) && h !== hospital);

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

        {/* 수치 선택 트리거 */}
        <button onClick={() => setShowPicker(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-blue-300 text-blue-600 text-sm font-medium active:bg-blue-50 transition-colors">
          <Plus size={16} /> 수치 선택{active.size > 0 ? ` (${active.size})` : ''}
        </button>

        {/* 입력 리스트 */}
        {inputList.length === 0 ? (
          <p className="text-[12px] text-gray-400 text-center py-6">위 &quot;수치 선택&quot;에서 결과지의 항목을 골라 값을 입력해요.<br />값 넣은 항목만 저장돼요.</p>
        ) : (
          <div className="space-y-1.5">
            {inputList.map((i) => (
              <div key={i.key} className="flex items-center gap-2">
                <span className="text-[12px] text-gray-600 w-28 flex-shrink-0 truncate" title={i.label}>{i.label}</span>
                <input type="text" inputMode={i.valueType === 'numeric' ? 'decimal' : 'text'}
                  value={values[i.key]?.raw ?? ''} onChange={(e) => setVal(i.key, e.target.value)}
                  placeholder={i.valueType === 'numeric' ? '값' : (i.valueType === 'semi_quantitative' ? '+/-' : '')}
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" value={values[i.key]?.unit ?? ''} onChange={(e) => setUnit(i.key, e.target.value)} placeholder="단위"
                  className="w-14 flex-shrink-0 px-2 py-1.5 border border-gray-100 rounded-lg text-[11px] text-gray-500 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-400" />
                <button onClick={() => toggleAnalyte(i.key, values[i.key]?.unit ?? '')} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0" aria-label="제거"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

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

      {/* 수치 선택 바텀시트 — 검사 종류별 체크박스(영/한). */}
      <FilterSheet open={showPicker} title="수치 선택" closeLabel="닫기" doneLabel="완료" onClose={() => setShowPicker(false)}>
        <div className="space-y-4">
          {LAB_TEMPLATES.filter((t) => t.key !== 'custom').map((tpl) => {
            const analytes = LAB_ANALYTES.filter((a) => a.templates.includes(tpl.key));
            return (
              <div key={tpl.key}>
                <p className="text-[11px] font-bold text-gray-400 mb-1.5">{tpl.emoji} {tpl.labelKo}</p>
                <div className="grid grid-cols-2 gap-x-3">
                  {analytes.map((a) => (
                    <label key={a.key} className="flex items-center gap-1.5 py-1 cursor-pointer">
                      <input type="checkbox" checked={active.has(a.key)} onChange={() => toggleAnalyte(a.key, a.defaultUnit)}
                        className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                      <span className="text-[12px] text-gray-700 truncate" title={analyteDisplay(a)}>{analyteDisplay(a)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {/* 직접 추가 */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">➕ 직접 추가</p>
            {customs.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 mb-1.5">
                {customs.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5 py-1 cursor-pointer">
                    <input type="checkbox" checked={active.has(c.key)} onChange={() => toggleAnalyte(c.key, c.unit)} className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                    <span className="text-[12px] text-gray-700 truncate" title={c.label}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                placeholder="항목명 직접 입력 (예: Reticulocyte)" maxLength={24}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={addCustom} className="px-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">추가</button>
            </div>
          </div>
        </div>
      </FilterSheet>
    </div>
  );
}

export default function AddLabPage() {
  return <Suspense fallback={<div className="bg-white min-h-full" />}><AddLabInner /></Suspense>;
}
