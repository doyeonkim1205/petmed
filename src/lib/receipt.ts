// 영수증 OCR 공통 타입/상수 (Phase 1a).

export const RECEIPT_CATEGORIES = ['consult', 'test', 'med', 'treatment', 'vaccine', 'etc'] as const;
export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

export interface ReceiptItem {
  name: string;
  amount: number;
  category: ReceiptCategory;
  note?: string;
}

/** 카테고리 한글 라벨 (UI 표시·드롭다운) */
export const RECEIPT_CATEGORY_LABEL: Record<ReceiptCategory, string> = {
  consult: '진찰',
  test: '검사',
  med: '약/주사',
  treatment: '처치/수술',
  vaccine: '예방접종',
  etc: '기타',
};

/** 카테고리 색상 (간이 영수증/통계 공통) */
export const RECEIPT_CATEGORY_COLOR: Record<ReceiptCategory, string> = {
  consult: 'bg-blue-100 text-blue-600',
  test: 'bg-violet-100 text-violet-600',
  med: 'bg-emerald-100 text-emerald-600',
  treatment: 'bg-amber-100 text-amber-600',
  vaccine: 'bg-rose-100 text-rose-600',
  etc: 'bg-gray-100 text-gray-500',
};

/** 카테고리 막대 색상 (통계 비중 그래프) */
export const RECEIPT_CATEGORY_BAR: Record<ReceiptCategory, string> = {
  consult: 'bg-blue-400',
  test: 'bg-violet-400',
  med: 'bg-emerald-400',
  treatment: 'bg-amber-400',
  vaccine: 'bg-rose-400',
  etc: 'bg-gray-400',
};

/** /api/receipt-ocr 응답 */
export interface ReceiptOcrResult {
  is_receipt: boolean;
  hospital_name: string | null;
  date: string | null;
  total: number | null;
  pet_name: string | null;
  items: ReceiptItem[];
  summary: string;
  confidence: 'low' | 'medium' | 'high';
}

/** 항목 배열 → 카테고리별 합계 (간이 영수증·통계) */
export function sumByCategory(items: ReceiptItem[]): Record<ReceiptCategory, number> {
  const out = { consult: 0, test: 0, med: 0, treatment: 0, vaccine: 0, etc: 0 };
  for (const it of items) out[it.category] = (out[it.category] || 0) + (it.amount || 0);
  return out;
}

export function isReceiptCategory(v: unknown): v is ReceiptCategory {
  return typeof v === 'string' && (RECEIPT_CATEGORIES as readonly string[]).includes(v);
}
