'use client';

// 검사 수치 상세 v1 — 수치 목록 + 추이 그래프 + 결과지 첨부(조회 전용) + 수정/삭제. i18n TODO.
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, FlaskConical, Pencil, TrendingUp, FileText, Image as ImageIcon, X } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LabTrendModal } from '@/components/records/LabTrendModal';
import { useLabTests, LabTest, LabTestFile } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, getAnalyte, type LabTemplateKey } from '@/lib/labCatalog';
import { trackEvent } from '@/lib/trackEvent';

const catLabel = (key: string) => LAB_TEMPLATES.find((t) => t.key === key)?.labelKo ?? key;
// 카테고리 많으면 제목 잘리니 '첫 외 N개'로 요약(2개 이하는 그대로 나열).
const catSummary = (cats?: string[] | null) => {
  const labels = (cats || []).map(catLabel);
  if (labels.length === 0) return '검사';
  if (labels.length <= 2) return labels.join(' · ');
  return `${labels[0]} 외 ${labels.length - 1}개`;
};

export default function LabDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { getLabTest, deleteLabTest, getFileUrl } = useLabTests();

  const [test, setTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trend, setTrend] = useState<{ key: string; label: string } | null>(null);
  const [showTrendHint, setShowTrendHint] = useState(false); // 추이 안내 말풍선 — 닫으면 래퍼째 사라짐(빈칸 방지)

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

  // 추이 안내 말풍선 — 닫기 전까지 노출, 닫으면 localStorage 기록 + 즉시 사라짐(빈칸 없음).
  useEffect(() => { try { if (!localStorage.getItem('hint_lab_trend')) setShowTrendHint(true); } catch { /* noop */ } }, []);
  const dismissTrendHint = () => { setShowTrendHint(false); try { localStorage.setItem('hint_lab_trend', '1'); } catch { /* noop */ } };

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
  const isGraphable = (v: typeof values[number]) => !!getAnalyte(v.analyte_key)?.graphable && v.value_numeric != null;

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
  // 추이 안내 말풍선을 붙일 '첫 그래프 가능한 수치' — 그 행 바로 아래에 왼쪽 꼬리로 표시.
  const firstGraphId = groups.flatMap((g) => g.vals).find(isGraphable)?.id ?? null;

  const renderValueRow = (v: typeof values[number]) => {
    const meta = getAnalyte(v.analyte_key);
    const lbl = v.label || meta?.labelKo || v.analyte_key;
    const canTrend = !!meta?.graphable && v.value_numeric != null;
    // 참고범위는 상세에 병기하지 않음(그래프 탭 시 하단 캡션에 표시). 값만 표시.
    const inner = (
      <>
        <span className="text-[13px] text-gray-600 flex items-center gap-1">{lbl}{canTrend && <TrendingUp size={12} className="text-indigo-400" />}</span>
        <span className="text-[13px] font-semibold text-gray-900 tabular-nums">{v.value_raw}{v.unit ? <span className="text-gray-400 font-normal"> {v.unit}</span> : null}</span>
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
        </header>
      </div>

      <div className="max-w-sm mx-auto px-4 pt-4">
        {/* 헤더 요약 — 수정/삭제는 기록 상세처럼 우측에 */}
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FlaskConical size={20} className="text-indigo-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 truncate">{catSummary(test.categories)}</p>
            <p className="text-[12px] text-gray-400">{test.test_date}{test.hospital_name ? ` · ${test.hospital_name}` : ''}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => router.push(`/records/labs/${id}/edit?from=detail`)} className="p-1.5 text-gray-700 hover:text-gray-900 transition-colors" aria-label="수정"><Pencil size={16} /></button>
            <button onClick={() => setConfirmDel(true)} disabled={deleting} className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors" aria-label="삭제"><Trash2 size={16} /></button>
          </div>
        </div>

        {/* 수치 — 카테고리별 섹션. 첫 그래프 수치 행 아래에 추이 안내 말풍선(꼬리 왼쪽). */}
        {values.length > 0 ? (
          <div className="space-y-3">
            {groups.map(({ tpl, vals }) => (
              <div key={tpl.key}>
                <p className="text-[11px] font-bold text-gray-400 mb-1 px-0.5">{tpl.labelKo}</p>
                <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {vals.map((v) => v.id === firstGraphId && showTrendHint ? (
                    <div key={v.id}>
                      {renderValueRow(v)}
                      <div className="px-3 pt-1 pb-2">
                        <div className="relative flex items-start gap-2 rounded-xl bg-white border border-blue-300 px-3 py-2 text-[11px] font-medium text-blue-600 shadow-[0_6px_22px_rgba(37,99,235,0.28)]">
                          <span className="absolute -top-1 left-4 w-2.5 h-2.5 rotate-45 bg-white border-l border-t border-blue-300" />
                          <p className="flex-1 leading-snug break-keep">수치를 누르면 추이 그래프를 볼 수 있어요.</p>
                          <button type="button" onClick={dismissTrendHint} aria-label="닫기" className="-mt-0.5 -mr-0.5 flex-shrink-0 p-0.5 text-blue-400 hover:text-blue-600 active:scale-90"><X size={16} strokeWidth={2.5} /></button>
                        </div>
                      </div>
                    </div>
                  ) : renderValueRow(v))}
                </div>
              </div>
            ))}
            {customVals.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-1 px-0.5">직접 추가</p>
                <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">{customVals.map(renderValueRow)}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">입력된 수치가 없어요.</p>
        )}

        {test.memo && (
          <div className="mt-5">
            <p className="text-[11px] font-bold text-gray-400 mb-1">메모</p>
            <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{test.memo}</p>
          </div>
        )}

        {/* 결과지 첨부 — 메모 아래, 조회 전용 리스트(탭하면 원본). 첨부 있을 때만 노출. 추가/삭제는 '수정'에서. */}
        {files.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">결과지</p>
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
          </div>
        )}
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
