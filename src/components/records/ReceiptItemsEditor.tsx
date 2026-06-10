'use client';

import { Plus, Trash2 } from 'lucide-react';
import { RECEIPT_CATEGORIES, RECEIPT_CATEGORY_LABEL, type ReceiptCategory, type ReceiptItem } from '@/lib/receipt';

/**
 * 영수증 항목 편집 리스트 (이름·카테고리·금액 + 추가/삭제).
 * 스캔 확인 시트(ReceiptScanSheet)와 수정 페이지 편집 모달(ReceiptEditModal)에서 공용.
 */
export function ReceiptItemsEditor({
  items,
  onChange,
}: {
  items: ReceiptItem[];
  onChange: (items: ReceiptItem[]) => void;
}) {
  const update = (i: number, patch: Partial<ReceiptItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { name: '', amount: 0, category: 'etc' }]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-400">항목 ({items.length})</span>
        <button type="button" onClick={add} className="text-[11px] text-blue-600 flex items-center gap-0.5">
          <Plus size={12} /> 항목 추가
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-3 break-keep break-words">
          항목 내역이 없어요. 필요하면 직접 추가할 수 있어요.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={it.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="항목명"
                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
              />
              <select
                value={it.category}
                onChange={(e) => update(i, { category: e.target.value as ReceiptCategory })}
                className="px-1.5 py-1.5 border border-gray-200 rounded-lg text-[11px] bg-white flex-shrink-0"
              >
                {RECEIPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{RECEIPT_CATEGORY_LABEL[c]}</option>
                ))}
              </select>
              <input
                inputMode="numeric"
                value={it.amount || ''}
                onChange={(e) => update(i, { amount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                placeholder="0"
                className="w-16 px-1.5 py-1.5 border border-gray-200 rounded-lg text-xs text-right outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button type="button" onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
