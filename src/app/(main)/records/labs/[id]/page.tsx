'use client';

// 검사 수치 상세 v1 — 수치 목록 + 추이 그래프 + 수정/삭제. TODO: 결과지 첨부는 다음 단계. i18n.
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, FlaskConical, Pencil, TrendingUp } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LabTrendModal } from '@/components/records/LabTrendModal';
import { useLabTests, LabTest } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, getAnalyte } from '@/lib/labCatalog';
import { trackEvent } from '@/lib/trackEvent';

const catLabel = (key: string) => LAB_TEMPLATES.find((t) => t.key === key)?.labelKo ?? key;

export default function LabDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { getLabTest, deleteLabTest } = useLabTests();

  const [test, setTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trend, setTrend] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    getLabTest(id).then((t) => { setTest(t); setLoading(false); trackEvent('lab_detail_view'); });
  }, [id, getLabTest]);

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

  return (
    <div className="bg-white min-h-full pb-24">
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label="뒤로"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-sm font-semibold text-gray-700">검사 상세</h1>
          <div className="absolute right-1 flex items-center">
            <button onClick={() => router.push(`/records/labs/${id}/edit`)} className="p-2 text-gray-500 hover:text-gray-800" aria-label="수정"><Pencil size={16} /></button>
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

        {/* 수치 */}
        {values.length > 0 ? (
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">
            {values.map((v) => {
              const meta = getAnalyte(v.analyte_key);
              const lbl = v.label || meta?.labelKo || v.analyte_key;
              const canTrend = !!meta?.graphable && v.value_numeric != null;
              const inner = (
                <>
                  <span className="text-[13px] text-gray-600 flex items-center gap-1">
                    {lbl}{canTrend && <TrendingUp size={12} className="text-indigo-400" />}
                  </span>
                  <span className="text-[13px] font-semibold text-gray-900 tabular-nums">
                    {v.value_raw}{v.unit ? <span className="text-gray-400 font-normal"> {v.unit}</span> : null}
                  </span>
                </>
              );
              return canTrend ? (
                <button key={v.id} onClick={() => setTrend({ key: v.analyte_key, label: lbl })}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">{inner}</button>
              ) : (
                <div key={v.id} className="flex items-center justify-between px-3 py-2.5">{inner}</div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">입력된 수치가 없어요.</p>
        )}

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
