'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Crown, ArrowRight } from 'lucide-react';

/**
 * 무료 → Plus 업그레이드 유도 안내 카드 (Design C — 앱 전체 업셀 톤과 통일).
 * 저장 용량 초과 / 로그인 기기 초과 등 "한도에 막힌 무료 사용자" 자리에 사용.
 * 탭하면 구독 페이지로 이동. 차단 로직은 호출부에 있고 이 컴포넌트는 안내+CTA 만 담당.
 */
export function PlusUpgradeNotice({
  message,
  subMessage,
  className = '',
  hideButton = false,
}: {
  message: React.ReactNode;
  subMessage?: React.ReactNode;
  className?: string;
  /** 로그아웃 화면(로그인 등)처럼 구독 페이지로 보낼 수 없는 자리에선 버튼 숨김 — 안내만. */
  hideButton?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div
      className={`rounded-xl border border-[#e2e0fb] bg-gradient-to-br from-[#eef4ff] to-[#f3eeff] p-3.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Crown size={14} className="text-purple-600" />
        <span className="text-xs font-bold text-purple-700">{t('upsell.plusUpgrade')}</span>
      </div>
      <p className="text-[13px] font-medium leading-relaxed text-[#3f3a52] break-keep">{message}</p>
      {subMessage && (
        <p className="text-xs leading-relaxed text-[#7c7691] mt-1 break-keep">{subMessage}</p>
      )}
      {!hideButton && (
        <button
          type="button"
          onClick={() => router.push('/profile/subscription')}
          className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white transition active:scale-[0.98]"
        >
          {t('upsell.viewPlus')} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
