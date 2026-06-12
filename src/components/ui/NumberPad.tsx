'use client';

import { Delete } from 'lucide-react';

interface NumberPadProps {
  value: string;
  onChange: (v: string) => void;
  /** 소수점 허용 여부 (기본 true) */
  decimal?: boolean;
  /** 정수부 최대 자릿수 (기본 5) */
  maxIntDigits?: number;
  /** 소수부 최대 자릿수 (기본 1) */
  maxDecimals?: number;
  /** 헤더 라벨 (예: "체중") */
  label?: string;
  /** 값 뒤 단위 (예: "kg") */
  suffix?: string;
  /** 바깥/완료 탭 시 닫기 */
  onClose?: () => void;
}

/**
 * 앱 내장 숫자 패드 (바텀 시트).
 * OS 키보드를 띄우지 않고 숫자를 입력받기 위한 컴포넌트.
 * → 크롬 autofill 칩(위치·카드·열쇠고리)이 키보드 위에 뜨던 문제를 원천 차단.
 * 입력칸은 readOnly + inputMode="none" 으로 두고, 탭하면 이 패드를 띄운다.
 */
export function NumberPad({
  value,
  onChange,
  decimal = true,
  maxIntDigits = 5,
  maxDecimals = 1,
  label,
  suffix,
  onClose,
}: NumberPadProps) {
  const press = (key: string) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!decimal || value.includes('.')) return;
      onChange((value === '' ? '0' : value) + '.');
      return;
    }
    // 숫자 — 정수/소수 자릿수 검증
    const next = value + key;
    const re = new RegExp(`^\\d{0,${maxIntDigits}}(\\.\\d{0,${maxDecimals}})?$`);
    if (re.test(next)) onChange(next);
  };

  const keys: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? '.' : 'blank', '0', 'back'];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-gray-50 rounded-t-2xl p-3 pb-5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-1 pb-2.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {label && <span className="text-xs font-medium text-gray-400 flex-shrink-0">{label}</span>}
            <span className="text-lg font-bold text-gray-900 truncate">
              {value || 0}
              {suffix && <span className="text-sm font-medium text-gray-400 ml-0.5">{suffix}</span>}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-blue-600 px-3 py-1 active:scale-95 flex-shrink-0"
          >
            완료
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k, i) =>
            k === 'blank' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                className="h-12 rounded-xl bg-white border border-gray-200 text-lg font-semibold text-gray-800 active:bg-gray-100 transition-colors flex items-center justify-center"
              >
                {k === 'back' ? <Delete size={20} className="text-gray-500" /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
