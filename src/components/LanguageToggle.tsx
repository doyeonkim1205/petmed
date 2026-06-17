'use client';

import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

/**
 * 언어 선택 UI (controlled). 부수효과 없음 — 탭하면 onChange 로 선택만 알린다.
 * 실제 적용(쿠키 저장·계정 동기화·새로고침)은 상위 모달의 "확인" 버튼이 담당한다.
 * (탭 즉시 새로고침되면 확인 전에 적용돼버리는 문제 때문에 분리)
 */
export function LanguageToggle({
  value,
  onChange,
  disabled,
}: {
  value: Locale;
  onChange: (next: Locale) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('settings');

  const options: { value: Locale; label: string }[] = [
    { value: 'ko', label: t('korean') },
    { value: 'en', label: t('english') },
  ];

  // 글자 크기·기본 반려동물 선택 UI 와 동일한 알약(pill) 버튼 스타일로 통일.
  return (
    <div className="flex gap-2" role="group" aria-label={t('language')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
            value === opt.value
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
