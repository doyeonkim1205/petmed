'use client';

// 검사 수치 상세 v1 — 수치 목록 + 추이 그래프 + 결과지 첨부 + 수정/삭제. i18n TODO.
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, FlaskConical, Pencil, TrendingUp, Plus, X, FileText } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LabTrendModal } from '@/components/records/LabTrendModal';
import { SafeImage } from '@/components/ui/SafeImage';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/authFetch';
import { uploadFile } from '@/services/fileUpload';
import { useLabTests, LabTest, LabTestFile } from '@/hooks/useLabTests';
import { LAB_TEMPLATES, getAnalyte, type LabTemplateKey } from '@/lib/labCatalog';
import { trackEvent } from '@/lib/trackEvent';

const catLabel = (key: string) => LAB_TEMPLATES.find((t) => t.key === key)?.labelKo ?? key;
const ALLOWED_FILE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export default function LabDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getLabTest, deleteLabTest, insertLabFile, deleteLabFile, getFileUrl } = useLabTests();

  const [test, setTest] = useState<LabTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trend, setTrend] = useState<{ key: string; label: string } | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [confirmDelFile, setConfirmDelFile] = useState<LabTestFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 이미지 첨부 미리보기용 signedUrl 발급.
  useEffect(() => {
    (test?.lab_test_files ?? []).filter((f) => f.file_type.startsWith('image/')).forEach(async (f) => {
      if (fileUrls[f.id]) return;
      const u = await getFileUrl(f.file_path);
      if (u) setFileUrls((p) => ({ ...p, [f.id]: u }));
    });
  }, [test, getFileUrl, fileUrls]);

  const files = test?.lab_test_files ?? [];

  const openFile = async (f: LabTestFile) => {
    const u = fileUrls[f.id] || (await getFileUrl(f.file_path));
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };

  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) => ALLOWED_FILE.includes(f.type));
    e.target.value = '';
    if (!picked.length || !test || !user) return;
    setFileMsg(null);
    setUploading(true);
    const usage = await authFetch('/api/storage-usage').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (usage && !usage.canUpload) { setFileMsg('저장용량이 가득 찼어요. 저장공간을 정리한 뒤 다시 시도해주세요.'); setUploading(false); return; }
    let failed = 0;
    for (const file of picked) {
      try {
        const { path } = await uploadFile(file, user.id, test.id);
        await insertLabFile({ lab_test_id: test.id, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size });
      } catch (err) { failed++; Sentry.captureException(err, { tags: { feature: 'labs', action: 'file-add' } }); }
    }
    const fresh = await getLabTest(id); if (fresh) setTest(fresh);
    sessionStorage.setItem('lab_list_reload', '1');
    if (failed > 0) setFileMsg(`파일 ${failed}개 업로드에 실패했어요. 다시 시도해주세요.`);
    setUploading(false);
  };

  const doDeleteFile = async () => {
    if (!confirmDelFile) return;
    try { await deleteLabFile(confirmDelFile.id, confirmDelFile.file_path); } catch { /* noop */ }
    setFileUrls((p) => { const n = { ...p }; delete n[confirmDelFile.id]; return n; });
    const fresh = await getLabTest(id); if (fresh) setTest(fresh);
    sessionStorage.setItem('lab_list_reload', '1');
    setConfirmDelFile(null);
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

        {/* 결과지 첨부 — 이미지 썸네일 / PDF, 탭하면 원본(signedUrl 새 탭). 추가·삭제 가능. */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-bold text-gray-400">결과지</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-[11px] text-blue-500 flex items-center gap-0.5 disabled:opacity-50"><Plus size={11} /> 추가</button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={onAddFiles} />
          {files.length === 0 ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-3 border border-dashed border-gray-200 rounded-lg text-[12px] text-gray-400 active:bg-gray-50 transition-colors">
              결과지 사진·PDF를 추가해보세요
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f) => (
                <div key={f.id} className="relative">
                  <button onClick={() => openFile(f)} className="block w-full aspect-square rounded-lg overflow-hidden border border-gray-100">
                    {f.file_type.startsWith('image/') ? (
                      <SafeImage src={fileUrls[f.id] ?? ''} onRefetchUrl={() => getFileUrl(f.file_path)} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-1">
                        <FileText size={22} className="text-gray-400" />
                        <span className="text-[9px] text-gray-400">PDF</span>
                      </span>
                    )}
                  </button>
                  <button onClick={() => setConfirmDelFile(f)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="첨부 삭제"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          {uploading && <p className="text-[11px] text-gray-400 mt-1.5">업로드 중...</p>}
          {fileMsg && <p className="text-[11px] text-amber-500 mt-1.5">{fileMsg}</p>}
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

      <ConfirmModal
        open={!!confirmDelFile}
        title="첨부를 삭제할까요?"
        message="이 결과지 파일이 삭제돼요. 되돌릴 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={doDeleteFile}
        onCancel={() => setConfirmDelFile(null)}
      />

      {trend && test && (
        <LabTrendModal petId={test.pet_id} analyteKey={trend.key} label={trend.label} onClose={() => setTrend(null)} />
      )}
    </div>
  );
}
