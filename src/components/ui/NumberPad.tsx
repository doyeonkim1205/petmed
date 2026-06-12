'use client';

import { useEffect } from 'react';
import { Delete, X } from 'lucide-react';

interface NumberPadProps {
  value: string;
  onChange: (v: string) => void;
  /** 소수점 허용 여부 (기본 true) */
  decimal?: boolean;
  /** 정수부 최대 자릿수 (기본 5) */
  maxIntDigits?: number;
  /** 소수부 최대 자릿수 (기본 1) */
  maxDecimals?: number;
  /** 디스플레이에 천단위 콤마 표시 (금액용, decimal=false 와 함께) */
  thousands?: boolean;
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
  thousands = false,
  label,
  suffix,
  onClose,
}: NumberPadProps) {
  // 패드가 떠 있는 동안 배경 스크롤 잠금 (배경이 움직이지 않게)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
        className="relative w-full max-w-sm bg-white rounded-t-2xl p-4 pb-5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 X (우상단) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-2.5 right-2.5 p-1 text-gray-300 hover:text-gray-500 active:scale-90 transition"
        >
          <X size={18} />
        </button>

        {/* 디스플레이 — 중앙 큰 값 (iOS 풍) */}
        <div className="text-center pt-1 pb-3">
          {label && <span className="block text-[11px] font-semibold text-gray-400 mb-1">{label}</span>}
          <span className="text-3xl font-extrabold tracking-tight text-gray-900">
            {value === '' ? '0' : thousands ? Number(value).toLocaleString() : value}
          </span>
          {suffix && <span className="text-base font-semibold text-gray-400 ml-1">{suffix}</span>}
        </div>

        {/* 키패드 — 테두리 없는 플랫 키 */}
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((k, i) =>
            k === 'blank' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                className="h-[52px] rounded-2xl bg-gray-100 text-xl font-medium text-gray-900 active:bg-gray-200 transition-colors flex items-center justify-center"
              >
                {k === 'back' ? <Delete size={20} className="text-gray-500" /> : k}
              </button>
            ),
          )}
        </div>

        {/* 하단 확인 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-bold active:bg-blue-700 transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  );
}
