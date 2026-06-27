'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Crown } from 'lucide-react';

/**
 * 무료 → Plus 업그레이드 유도 안내 카드.
 * 검색/논문/증상 분석 한도 업셀(search 페이지)과 동일한 디자인으로 통일 —
 * 가운데 정렬 크라운 + 제목 + 본문 + 풀폭 그라데이션 "Plus 보기" 버튼.
 * 저장 용량 초과 / 로그인 기기 초과 등 "한도에 막힌 무료 사용자" 자리에 사용.
 * 차단 로직은 호출부에 있고 이 컴포넌트는 안내+CTA 만 담당.
 */
export function PlusUpgradeNotice({
  title,
  message,
  subMessage,
  className = '',
  hideButton = false,
}: {
  /** 헤더(크라운 옆) 문구 — 기본값 "Plus 업그레이드". */
  title?: React.ReactNode;
  message?: React.ReactNode;
  subMessage?: React.ReactNode;
  className?: string;
  /** 로그아웃 화면(로그인 등)처럼 구독 페이지로 보낼 수 없는 자리에선 버튼 숨김 — 안내만. */
  hideButton?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className={`p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl ${className}`}>
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Crown size={16} className="text-purple-500" />
        <p className="text-sm font-bold text-gray-700">{title ?? t('upsell.plusUpgrade')}</p>
      </div>
      {message && (
        <p className="text-xs text-gray-500 leading-relaxed text-center break-keep">{message}</p>
      )}
      {subMessage && (
        <p className="text-[11px] text-gray-400 leading-relaxed text-center break-keep mt-1">{subMessage}</p>
      )}
      {!hideButton && (
        <button
          type="button"
          onClick={() => router.push('/profile/subscription')}
          className="mt-3 w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium transition active:scale-[0.99]"
        >
          {t('upsell.viewPlans')}
        </button>
      )}
    </div>
  );
}
