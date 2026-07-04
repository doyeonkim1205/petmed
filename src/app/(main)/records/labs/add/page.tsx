'use client';

// 검사 수치 추가 v1 — 템플릿 아코디언(union dedup) + 값 있는 항목만 저장. Plus 전용.
// TODO: 결과지 첨부·참고범위 입력·i18n 은 다음 단계.
import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import { useLabTests, LabValueInput } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, LAB_ANALYTES, type LabTemplateKey } from '@/lib/labCatalog';

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
  // analyte_key → { raw, unit }
  const [values, setValues] = useState<Record<string, { raw: string; unit: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: LabTemplateKey) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  // 열린 템플릿을 순서대로 렌더하되, 이미 나온 analyte 는 skip(union dedup) → 같은 수치 입력칸 중복 방지.
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

  const setVal = (key: string, raw: string, unitDefault: string) =>
    setValues((prev) => ({ ...prev, [key]: { raw, unit: prev[key]?.unit ?? unitDefault } }));
  const setUnit = (key: string, unit: string, unitDefault: string) =>
    setValues((prev) => ({ ...prev, [key]: { raw: prev[key]?.raw ?? '', unit } }));

  const filledCount = Object.values(values).filter((v) => v.raw.trim() !== '').length;

  const handleSave = async () => {
    if (!petId) { setError('반려동물 정보가 없어요.'); return; }
    if (filledCount === 0) { setError('수치를 하나 이상 입력해주세요.'); return; }
    setError(null);
    setSaving(true);
    try {
      const vals: LabValueInput[] = LAB_ANALYTES
        .filter((a) => values[a.key]?.raw.trim())
        .map((a, i) => ({
          analyte_key: a.key,
          label: a.labelKo,
          value_raw: values[a.key].raw,
          unit: values[a.key].unit || a.defaultUnit,
          display_order: i,
        }));
      const categories = sections.filter((s) => open.has(s.tpl.key)).map((s) => s.tpl.key);
      await createLabTest({ pet_id: petId, test_date: testDate, hospital_name: hospital, categories, memo, values: vals });
      router.replace('/records/labs');
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'labs', action: 'create' } });
      setError('저장에 실패했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  };

  return (
    <div className="bg-white min-h-full pb-24">
      <header className="sticky top-12 z-30 bg-white flex items-center justify-center px-4 h-[52px] border-b border-gray-50">
        <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로"><ArrowLeft size={20} /></button>
        <h1 className="text-sm font-semibold text-gray-700">검사 추가</h1>
      </header>

      <div className="max-w-sm mx-auto px-4 pt-3 space-y-3">
        {/* 검사일 / 병원 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400">검사일</label>
            <DatePicker value={testDate} onChange={setTestDate} max={todayLocalISO()} inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400">병원 <span className="text-gray-300">(선택)</span></label>
            <input type="search" value={hospital} onChange={(e) => setHospital(e.target.value)} maxLength={30}
              placeholder="병원명" autoComplete="off"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none [&::-webkit-search-cancel-button]:hidden" />
          </div>
        </div>

        <p className="text-[11px] text-gray-400 pt-1">검사 결과지에서 확인하고 싶은 수치만 열어서 입력하면 돼요. 값 넣은 항목만 저장돼요.</p>

        {/* 템플릿 아코디언 */}
        <div className="space-y-2">
          {sections.map(({ tpl, analytes }) => {
            const isOpen = open.has(tpl.key);
            const cnt = analytes.filter((a) => values[a.key]?.raw.trim()).length;
            return (
              <div key={tpl.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <button onClick={() => toggle(tpl.key)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                  <span className="text-base">{tpl.emoji}</span>
                  <span className="text-[13px] font-bold text-gray-800 flex-1">{tpl.labelKo}</span>
                  {cnt > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {analytes.map((a) => (
                      <div key={a.key} className="flex items-center gap-2">
                        <span className="text-[12px] text-gray-600 w-24 flex-shrink-0 truncate" title={a.labelKo}>{a.labelKo}</span>
                        <input
                          type="text" inputMode={a.valueType === 'numeric' ? 'decimal' : 'text'}
                          value={values[a.key]?.raw ?? ''}
                          onChange={(e) => setVal(a.key, e.target.value, a.defaultUnit)}
                          placeholder={a.valueType === 'numeric' ? '값' : (a.valueType === 'semi_quantitative' ? '+/-' : '')}
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text" value={values[a.key]?.unit ?? a.defaultUnit}
                          onChange={(e) => setUnit(a.key, e.target.value, a.defaultUnit)}
                          className="w-16 flex-shrink-0 px-2 py-1.5 border border-gray-100 rounded-lg text-[11px] text-gray-500 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 메모 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">메모 <span className="text-gray-300">(선택)</span></label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500}
            placeholder="특이사항을 기록해보세요"
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
