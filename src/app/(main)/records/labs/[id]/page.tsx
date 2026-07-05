'use client';

// 검사 수치 상세 v1 — 수치 목록 + 추이 그래프 + 결과지 첨부(조회 전용) + 수정/삭제. i18n TODO.
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, FlaskConical, Pencil, TrendingUp, FileText, Image as ImageIcon } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LabTrendModal } from '@/components/records/LabTrendModal';
import { useLabTests, LabTest, LabTestFile } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, getAnalyte, type LabTemplateKey } from '@/lib/labCatalog';
import { trackEvent } from '@/lib/trackEvent';

const catLabel = (key: string) => LAB_TEMPLATES.find((t) => t.key === key)?.labelKo ?? key;

export default function LabDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { getLabTest, deleteLabTest, getFileUrl } = useLabTests();

  const [test, setTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trend, setTrend] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    getLabTest(id).then((t) => { setTest(t); setLoading(false); trackEvent('lab_detail_view'); });
  }, [id, getLabTest]);

  // 수정 후 back() 으로 돌아오면 상세가 스택에 살아있어 stale → popstate 때 재조회.
  useEffect(() => {
    const onPop = () => {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lab_updated_id') === id) {
        sessionStorage.removeItem('lab_updated_id');
        getLabTest(id).then((t) => { if (t) setTest(t); });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [id, getLabTest]);

  const files = test?.lab_test_files ?? [];

  // 첨부 조회 전용 — 탭하면 원본(signedUrl 새 탭). 추가/삭제는 '수정'에서.
  const openFile = async (f: LabTestFile) => {
    const u = await getFileUrl(f.file_path);
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    setConfirmDel(false);
    setDeleting(true);
    try {
      await deleteLabTest(id);
      router.replace('/records/labs');
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'labs', action: 'delete' } });
      setDeleting(false);
    }
  };

  if (loading) return <div className="bg-white min-h-full" />;
  if (!test) return (
    <div className="bg-white min-h-full flex flex-col items-center justify-center gap-2 py-20">
      <p className="text-sm text-gray-400">검사를 찾을 수 없어요.</p>
      <button onClick={() => router.replace('/records/labs')} className="text-sm text-blue-500">목록으로</button>
    </div>
  );

  const values = (test.lab_values || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  // 카테고리별 그룹핑(입력폼과 동일 정신모델). test.categories 순서 우선, 겹치는 analyte 는 첫 카테고리에만.
  const assigned = new Set<string>();
  const orderedCats = [...new Set([...(test.categories || []).filter((c) => c !== 'custom'), ...LAB_TEMPLATES.filter((t) => t.key !== 'custom').map((t) => t.key)])];
  const groups: { tpl: typeof LAB_TEMPLATES[number]; vals: typeof values }[] = [];
  for (const catKey of orderedCats) {
    const tpl = LAB_TEMPLATES.find((t) => t.key === catKey);
    if (!tpl) continue;
    const vals = values.filter((v) => !assigned.has(v.id) && !v.analyte_key.startsWith('CUSTOM:') && getAnalyte(v.analyte_key)?.templates.includes(catKey as LabTemplateKey));
    vals.forEach((v) => assigned.add(v.id));
    if (vals.length) groups.push({ tpl, vals });
  }
  const customVals = values.filter((v) => v.analyte_key.startsWith('CUSTOM:'));

  const renderValueRow = (v: typeof values[number]) => {
    const meta = getAnalyte(v.analyte_key);
    const lbl = v.label || meta?.labelKo || v.analyte_key;
    const canTrend = !!meta?.graphable && v.value_numeric != null;
    // 사용자가 입력한 참고범위 — 앱은 판정 안 함, 그대로 병기만.
    // ref_text 우선(한쪽범위 <0.2·선택형 음성 등 원문 보존). 없으면 low/high, 한쪽만이면 ≤/≥.
    const refStr = (v.ref_text ?? '').trim()
      ? (v.ref_text as string).trim()
      : v.ref_low != null && v.ref_high != null ? `${v.ref_low}–${v.ref_high}`
      : v.ref_high != null ? `≤${v.ref_high}`
      : v.ref_low != null ? `≥${v.ref_low}`
      : null;
    const inner = (
      <>
        <span className="text-[13px] text-gray-600 flex items-center gap-1">{lbl}{canTrend && <TrendingUp size={12} className="text-indigo-400" />}</span>
        <span className="flex flex-col items-end">
          <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{v.value_raw}{v.unit ? <span className="text-gray-400 font-normal"> {v.unit}</span> : null}</span>
          {refStr && <span className="text-[10px] text-gray-400 tabular-nums">입력한 참고범위 {refStr}</span>}
        </span>
      </>
    );
    return canTrend ? (
      <button key={v.id} onClick={() => setTrend({ key: v.analyte_key, label: lbl })} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">{inner}</button>
    ) : (
      <div key={v.id} className="flex items-center justify-between px-3 py-2.5">{inner}</div>
    );
  };

  return (
    <div className="bg-white min-h-full pb-24">
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-sm font-semibold text-gray-700">검사 상세</h1>
          <div className="absolute right-1 flex items-center">
            <button onClick={() => router.push(`/records/labs/${id}/edit?from=detail`)} className="p-2 text-gray-500 hover:text-gray-800" aria-label="수정"><Pencil size={16} /></button>
            <button onClick={() => setConfirmDel(true)} disabled={deleting} className="p-2 text-red-400 hover:text-red-600 disabled:opacity-50" aria-label="삭제"><Trash2 size={16} /></button>
          </div>
        </header>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-4">
        {/* 헤더 요약 */}
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FlaskConical size={20} className="text-indigo-500" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-gray-900 truncate">{(test.categories || []).map(catLabel).join(' · ') || '검사'}</p>
            <p className="text-[12px] text-gray-400">{test.test_date}{test.hospital_name ? ` · ${test.hospital_name}` : ''}</p>
          </div>
        </div>

        {/* 수치 — 카테고리별 섹션(입력폼과 동일). 📈 있는 수치 탭 시 추이. */}
        {values.length > 0 ? (
          <div className="space-y-3">
            {groups.map(({ tpl, vals }) => (
              <div key={tpl.key}>
                <p className="text-[11px] font-bold text-gray-400 mb-1 px-0.5">{tpl.emoji} {tpl.labelKo}</p>
                <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">{vals.map(renderValueRow)}</div>
              </div>
            ))}
            {customVals.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-1 px-0.5">➕ 직접 추가</p>
                <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">{customVals.map(renderValueRow)}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">입력된 수치가 없어요.</p>
        )}

        {/* 결과지 첨부 — 조회 전용 리스트(탭하면 원본). 추가/삭제는 '수정'에서. */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-gray-400 mb-1.5">결과지</p>
          {files.length === 0 ? (
            <p className="text-[12px] text-gray-300">첨부된 결과지가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {files.map((f) => (
                <button key={f.id} onClick={() => openFile(f)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-lg text-left active:bg-gray-100 transition-colors">
                  {f.file_type.startsWith('image/') ? <ImageIcon size={15} className="text-gray-400 flex-shrink-0" /> : <FileText size={15} className="text-gray-400 flex-shrink-0" />}
                  <span className="flex-1 min-w-0 text-[12px] text-gray-600 truncate">{f.file_name}</span>
                  <span className="text-[10px] text-gray-300 flex-shrink-0">{f.file_type.startsWith('image/') ? '사진' : 'PDF'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {test.memo && (
          <div className="mt-4">
            <p className="text-[11px] font-bold text-gray-400 mb-1">메모</p>
            <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{test.memo}</p>
          </div>
        )}

        <p className="text-[11px] text-gray-300 mt-6 leading-relaxed">PawDex는 의학적 진단이 아닌 기록·정리 도구예요. 수치 해석은 담당 수의사와 상의하세요.</p>
      </div>

      <ConfirmModal
        open={confirmDel}
        title="검사를 삭제할까요?"
        message="이 검사와 입력한 수치가 모두 삭제돼요. 되돌릴 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(false)}
      />

      {trend && test && (
        <LabTrendModal petId={test.pet_id} analyteKey={trend.key} label={trend.label} onClose={() => setTrend(null)} />
      )}
    </div>
  );
}
