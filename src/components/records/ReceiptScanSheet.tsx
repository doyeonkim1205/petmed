'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, X, Loader2, Crown, AlertCircle } from 'lucide-react';
import { compressImage } from '@/lib/imageCompress';
import { authFetch } from '@/lib/authFetch';
import { ReceiptItemsEditor } from '@/components/records/ReceiptItemsEditor';
import type { ReceiptItem, ReceiptOcrResult } from '@/lib/receipt';

/** dataURL(압축본) → File. 원본 영수증을 첨부로 저장할 때 사용. 실패 시 null. */
function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const [head, body] = dataUrl.split(',');
    const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg';
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  } catch {
    return null;
  }
}

const FREE_BATCH = 1;   // 무료는 평생 1회 체험 → 한 장만
const PLUS_BATCH = 5;   // Plus 는 한번에 최대 5장 (병렬 처리)

/**
 * 영수증 스캔 → 확인/수정 시트.
 * 여러 장 한번에 선택 → 각 영수증을 병렬(Promise.all) 분석 → 합쳐서 한 번에 확인/수정 → onApply.
 * 부모(add/edit)가 결과를 폼 상태에 병합(멀티 영수증 누적). receiptCount 로 장수 카운트.
 */
export function ReceiptScanSheet({
  onApply,
  hasExisting,
  isPaid,
  attachUsed,
  attachMax,
  onAttachImage,
}: {
  onApply: (r: { hospitalName: string; date: string | null; total: number | null; summary: string; items: ReceiptItem[]; receiptCount: number }) => void;
  hasExisting: boolean;
  isPaid: boolean;
  attachUsed: number;
  attachMax: number;
  onAttachImage: (file: File) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ msg: string; upgrade?: boolean } | null>(null);

  // 편집 가능한 결과 (모달에서 수정)
  const [hospital, setHospital] = useState('');
  const [date, setDate] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [imgDataUrls, setImgDataUrls] = useState<string[]>([]); // 원본 첨부용 (장수만큼)
  const [scannedCount, setScannedCount] = useState(0);          // 성공 장수
  const [failedCount, setFailedCount] = useState(0);            // 실패 장수
  const [saveImage, setSaveImage] = useState(false);

  const attachFreeSlots = Math.max(0, attachMax - attachUsed);

  const pick = () => { setError(null); inputRef.current?.click(); };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const all = Array.from(e.target.files || []);
    e.target.value = '';
    if (!all.length) return;
    const files = all.slice(0, isPaid ? PLUS_BATCH : FREE_BATCH);
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: files.length });

    // 각 영수증을 병렬 분석 (총 시간 ≈ 가장 느린 1장)
    const settled = await Promise.all(
      files.map(async (file) => {
        try {
          const { dataUrl } = await compressImage(file);
          const res = await authFetch('/api/receipt-ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageDataUrl: dataUrl }),
          });
          const data = await res.json();
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          if (!res.ok) return { ok: false as const, error: data.error as string, upgrade: !!data.upgradeRequired };
          if (data.is_receipt === false) return { ok: false as const, error: (data.error as string) || '영수증이 아닌 것 같아요.' };
          return { ok: true as const, result: data as ReceiptOcrResult, dataUrl };
        } catch {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          return { ok: false as const, error: '이미지를 처리하지 못했어요.' };
        }
      }),
    );

    setLoading(false);
    const ok = settled.filter((s): s is { ok: true; result: ReceiptOcrResult; dataUrl: string } => s.ok);
    if (ok.length === 0) {
      const first = settled.find((s) => !s.ok) as { ok: false; error: string; upgrade?: boolean } | undefined;
      setError({ msg: first?.error || '영수증 분석에 실패했어요.', upgrade: settled.some((s) => !s.ok && s.upgrade) });
      return;
    }

    // 여러 장 → 항목 합치고 총액 합산, 병원·날짜·요약은 첫 장 기준
    const merged = ok.flatMap((s) => s.result.items || []);
    const totalSum = ok.reduce((sum, s) => sum + (s.result.total || 0), 0);
    const head = ok[0].result;
    setHospital(head.hospital_name || '');
    setDate(head.date || '');
    setTotal(totalSum ? String(totalSum) : '');
    setSummary(head.summary || '');
    setItems(merged);
    setConfidence(ok.some((s) => s.result.confidence === 'low') ? 'low' : 'medium');
    setImgDataUrls(ok.map((s) => s.dataUrl));
    setScannedCount(ok.length);
    setFailedCount(settled.length - ok.length);
    setSaveImage(false);
    setOpen(true);
  };

  const apply = () => {
    onApply({
      hospitalName: hospital.trim(),
      date: date || null,
      total: total ? Math.max(0, Math.round(Number(total) || 0)) : null,
      summary: summary.trim(),
      items: items
        .map((it) => ({ ...it, name: it.name.trim(), amount: Math.max(0, Math.round(it.amount || 0)) }))
        .filter((it) => it.name),
      receiptCount: scannedCount,
    });
    // 원본 영수증 첨부 (Plus + 체크) — 빈 첨부칸만큼만
    if (saveImage && isPaid && imgDataUrls.length) {
      const n = Math.min(imgDataUrls.length, attachFreeSlots);
      for (let i = 0; i < n; i++) {
        const f = dataUrlToFile(imgDataUrls[i], `receipt-${Date.now()}-${i}.jpg`);
        if (f) onAttachImage(f);
      }
    }
    setOpen(false);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple={isPaid} onChange={handleFiles} className="hidden" />
      <button
        type="button"
        onClick={pick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-xs font-medium transition-colors hover:bg-blue-100 disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> 영수증 분석 중… {progress.total > 1 ? `(${progress.done}/${progress.total})` : ''}</>
        ) : (
          <><Receipt size={14} /> {hasExisting ? '영수증 추가' : '영수증으로 자동 입력'}{isPaid ? ' (여러 장 가능)' : ''}</>
        )}
      </button>

      {/* 분석 에러 / 업셀 — Plus 버튼 인라인 */}
      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-1.5">
          <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-700 break-keep break-words">
            {error.msg.split('\n').map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}
            {error.upgrade && (
              <button
                type="button"
                onClick={() => router.push('/profile/subscription')}
                className="ml-1.5 inline-flex items-center gap-0.5 text-blue-600 font-semibold align-baseline"
              >
                <Crown size={11} /> Plus 업그레이드
              </button>
            )}
          </div>
        </div>
      )}

      {/* 확인/수정 모달 */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Receipt size={16} className="text-blue-500" /> 영수증 내역 확인
                {scannedCount > 1 && <span className="text-[11px] font-normal text-gray-400">({scannedCount}장)</span>}
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {failedCount > 0 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 break-keep break-words">
                  {scannedCount}장 인식됨 · {failedCount}장은 실패했어요 (다시 시도해 주세요).
                </p>
              )}
              {confidence === 'low' && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 break-keep break-words">
                  흐릿하게 인식됐어요. 항목·금액을 한 번 확인해 주세요.
                </p>
              )}

              {/* 병원 / 날짜 / 총액 */}
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 text-[11px] text-gray-400">병원명
                  <input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="병원명"
                    className="mt-0.5 w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-[11px] text-gray-400">날짜
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="mt-0.5 w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-[11px] text-gray-400">총액(원)
                  <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                    className="mt-0.5 w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>

              {/* 항목 편집 */}
              <ReceiptItemsEditor items={items} onChange={setItems} />
            </div>

            {/* 원본 영수증 첨부 옵션 — Plus 만 노출, 첨부칸만큼 */}
            {isPaid ? (
              <label className={`flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 ${attachFreeSlots === 0 ? 'opacity-50' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={saveImage && attachFreeSlots > 0} disabled={attachFreeSlots === 0}
                  onChange={(e) => setSaveImage(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-[11px] text-gray-600 break-keep break-words">
                  원본 영수증도 첨부 {attachFreeSlots === 0 ? '· 첨부가 가득 찼어요' : `(빈 첨부 ${attachFreeSlots}칸 · 영수증 ${imgDataUrls.length}장)`}
                </span>
              </label>
            ) : (
              <p className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 break-keep break-words">
                원본 영수증 저장은 Plus 전용이에요
              </p>
            )}

            <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500">취소</button>
              <button type="button" onClick={apply} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white">이 내용으로 채우기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
