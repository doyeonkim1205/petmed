'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'info';
  /** true 면 취소 버튼 숨김 (단일 알림용 — alert() 대체) */
  hideCancel?: boolean;
  /** 기본 AlertTriangle 대신 다른 아이콘/배경을 쓰고 싶을 때.
   *  - icon: 아이콘 엘리먼트 (이미 color 클래스 적용된 상태로)
   *  - bgClassName: 아이콘 감싸는 원형 배경 색 (예: 'bg-orange-50') */
  icon?: React.ReactNode;
  bgClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  hideCancel = false,
  icon,
  bgClassName,
  onConfirm,
  onCancel,
}: Props) {
  const t = useTranslations();
  const confirmText = confirmLabel ?? t('common.confirm');
  const cancelText = cancelLabel ?? t('common.cancel');
  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-500 text-white'
      : 'bg-blue-600 text-white';

  // 기본 아이콘 배경 색. icon prop 으로 커스텀 할 때 bgClassName 로 덮어씀.
  const defaultBg = variant === 'danger' ? 'bg-red-50' : 'bg-blue-50';
  const defaultIconColor = variant === 'danger' ? 'text-red-500' : 'text-blue-500';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-0.5 text-gray-300 hover:text-gray-500"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              bgClassName || defaultBg
            }`}
          >
            {icon || (
              <AlertTriangle size={16} className={defaultIconColor} />
            )}
          </div>
          <p className="text-sm font-bold text-gray-800">{title}</p>
        </div>

        {message && (
          <div className="text-xs text-gray-500 leading-relaxed mb-4">
            {message}
          </div>
        )}

        <div className="flex gap-2">
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-xs font-bold rounded-full"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-xs font-bold rounded-full ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
