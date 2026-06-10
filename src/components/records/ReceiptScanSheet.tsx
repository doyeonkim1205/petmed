'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, X, Plus, Trash2, Loader2, Crown, AlertCircle } from 'lucide-react';
import { compressImage } from '@/lib/imageCompress';
import { authFetch } from '@/lib/authFetch';
import {
  RECEIPT_CATEGORIES,
  RECEIPT_CATEGORY_LABEL,
  type ReceiptCategory,
  type ReceiptItem,
  type ReceiptOcrResult,
} from '@/lib/receipt';

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

/**
 * 영수증 스캔 → 확인/수정 시트.
 * 버튼 클릭 → 이미지 선택 → /api/receipt-ocr → 모달에서 확인/수정 → onApply 로 부모에 전달.
 * 부모(add/edit)가 onApply 결과를 폼 상태에 병합(멀티 영수증 누적).
 */
export function ReceiptScanSheet({
  onApply,
  hasExisting,
  isPaid,
  attachUsed,
  attachMax,
  onAttachImage,
}: {
  onApply: (r: { hospitalName: string; date: string | null; total: number | null; summary: string; items: ReceiptItem[] }) => void;
  hasExisting: boolean;
  isPaid: boolean;
  attachUsed: number;
  attachMax: number;
  onAttachImage: (file: File) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ msg: string; upgrade?: boolean } | null>(null);

  // 편집 가능한 결과 (모달에서 수정)
  const [hospital, setHospital] = useState('');
  const [date, setDate] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [imgDataUrl, setImgDataUrl] = useState('');   // 원본 첨부용 (압축본)
  const [saveImage, setSaveImage] = useState(false);  // 원본 영수증 첨부 여부 (Plus)

  const attachFull = attachUsed >= attachMax;

  const pick = () => { setError(null); inputRef.current?.click(); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { dataUrl } = await compressImage(file);
      const res = await authFetch('/api/receipt-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ msg: data.error || '영수증 분석에 실패했어요.', upgrade: !!data.upgradeRequired });
        return;
      }
      if (data.is_receipt === false) {
        setError({ msg: data.error || '영수증이 아닌 것 같아요.' });
        return;
      }
      const r = data as ReceiptOcrResult;
      setHospital(r.hospital_name || '');
      setDate(r.date || '');
      setTotal(r.total != null ? String(r.total) : '');
      setSummary(r.summary || '');
      setItems(r.items || []);
      setConfidence(r.confidence || 'medium');
      setImgDataUrl(dataUrl);
      setSaveImage(false);
      setOpen(true);
    } catch {
      setError({ msg: '이미지를 처리하지 못했어요. 다시 시도해 주세요.' });
    } finally {
      setLoading(false);
    }
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
    });
    // 원본 영수증 첨부 (Plus + 체크 + 빈 첨부칸 있을 때)
    if (saveImage && isPaid && !attachFull && imgDataUrl) {
      const f = dataUrlToFile(imgDataUrl, `receipt-${Date.now()}.jpg`);
      if (f) onAttachImage(f);
    }
    setOpen(false);
  };

  const updateItem = (i: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addItem = () => setItems((prev) => [...prev, { name: '', amount: 0, category: 'etc' }]);

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={pick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-xs font-medium transition-colors hover:bg-blue-100 disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> 영수증 분석 중…</>
        ) : (
          <><Receipt size={14} /> {hasExisting ? '영수증 추가' : '영수증으로 자동 입력'}</>
        )}
      </button>

      {/* 분석 에러 / 업셀 */}
      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-1.5">
          <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-700 break-keep break-words">
            {error.msg.split('\n').map((l, i) => <p key={i}>{l}</p>)}
            {error.upgrade && (
              <button type="button" onClick={() => router.push('/profile/subscription')}
                className="mt-1 inline-flex items-center gap-1 text-blue-600 font-semibold">
                <Crown size={11} /> Plus 업그레이드
              </button>
            )}
          </div>
        </div>
      )}

      {/* 확인/수정 모달 */}
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Receipt size={16} className="text-blue-500" /> 영수증 내역 확인</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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

              {/* 항목 리스트 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-400">항목 ({items.length})</span>
                  <button type="button" onClick={addItem} className="text-[11px] text-blue-600 flex items-center gap-0.5"><Plus size={12} /> 항목 추가</button>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-3 break-keep break-words">항목 내역이 없어요 (총액만). 필요하면 직접 추가할 수 있어요.</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="항목명"
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400" />
                        <select value={it.category} onChange={(e) => updateItem(i, { category: e.target.value as ReceiptCategory })}
                          className="px-1.5 py-1.5 border border-gray-200 rounded-lg text-[11px] bg-white flex-shrink-0">
                          {RECEIPT_CATEGORIES.map((c) => <option key={c} value={c}>{RECEIPT_CATEGORY_LABEL[c]}</option>)}
                        </select>
                        <input inputMode="numeric" value={it.amount || ''} onChange={(e) => updateItem(i, { amount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0"
                          className="w-16 px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-right outline-none focus:ring-1 focus:ring-blue-400" />
                        <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 원본 영수증 첨부 옵션 — Plus 만 노출, 첨부 1칸 사용 */}
            {isPaid ? (
              <label className={`flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 ${attachFull ? 'opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={saveImage && !attachFull}
                  disabled={attachFull}
                  onChange={(e) => setSaveImage(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-[11px] text-gray-600 break-keep break-words">
                  원본 영수증도 첨부 {attachFull ? '· 첨부가 가득 찼어요' : `(첨부 ${attachUsed}/${attachMax})`}
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
