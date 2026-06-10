'use client';

import { useState, useEffect } from 'react';
import { Receipt, X, Trash2 } from 'lucide-react';
import { ReceiptItemsEditor } from '@/components/records/ReceiptItemsEditor';
import type { ReceiptItem } from '@/lib/receipt';

/**
 * 간이 영수증 보기/편집 모달 — 수정 페이지에서 기존 receipt_items 를 보고 수정·삭제.
 * 로컬 복사본을 편집 후 저장 시 onSave 로 부모(receiptItems state)에 반영.
 */
export function ReceiptEditModal({
  open,
  items: initial,
  onSave,
  onClose,
}: {
  open: boolean;
  items: ReceiptItem[];
  onSave: (items: ReceiptItem[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ReceiptItem[]>(initial);

  useEffect(() => {
    if (open) setItems(initial);
  }, [open, initial]);

  if (!open) return null;

  const sum = items.reduce((s, it) => s + (it.amount || 0), 0);

  const save = () => {
    onSave(
      items
        .map((it) => ({ ...it, name: it.name.trim(), amount: Math.max(0, Math.round(it.amount || 0)) }))
        .filter((it) => it.name),
    );
    onClose();
  };

  const deleteAll = () => {
    onSave([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Receipt size={16} className="text-blue-500" /> 영수증 내역 편집
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <ReceiptItemsEditor items={items} onChange={setItems} />
          <p className="text-[11px] text-gray-400 text-right">
            항목 합계 {new Intl.NumberFormat('ko-KR').format(sum)}원
          </p>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={deleteAll} className="px-3 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-500 flex items-center gap-1">
            <Trash2 size={14} /> 전체 삭제
          </button>
          <button type="button" onClick={save} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white">저장</button>
        </div>
      </div>
    </div>
  );
}
