'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isTrialActive, trialDaysLeft } from '@/lib/plans';

const LAST_SEEN_KEY = 'trial_banner_last_seen';

/**
 * 홈 화면 트라이얼 안내 카드.
 * - 트라이얼 기간 중에만 렌더
 * - 하루 1번만 표시 (localStorage 에 마지막으로 본 KST 날짜 기록)
 * - 첫 렌더 시점에 "봤음" 처리 → X 로 닫아도 그 날은 안 뜸
 * - 자정 지나면 다시 뜸 (카운트다운 자연스럽게 감소)
 * - 카드 본체 탭하면 구독 관리 페이지로 이동
 */
export function TrialBanner() {
  const t = useTranslations();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTrialActive()) return;
    // KST 자정 기준으로 날짜 변경 감지. 한국 유저 직관과 일치.
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    try {
      if (localStorage.getItem(LAST_SEEN_KEY) !== today) {
        setVisible(true);
        localStorage.setItem(LAST_SEEN_KEY, today);
      }
    } catch {
      /* privacy mode 등 localStorage 접근 실패 시엔 표시 X (튀는 것보다 낫다) */
    }
  }, []);

  if (!visible) return null;
  const days = trialDaysLeft();

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-4 mx-4 mt-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
            <span>🎉</span>
          </div>
          <h3 className="text-sm font-bold text-gray-900">{t('trialBanner.title')}</h3>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-3 pl-10">
        {t.rich('trialBanner.body', { days, br: () => <br /> })}
      </p>
      <button
        onClick={() => router.push('/profile/subscription')}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full transition-colors"
      >
        {t('trialBanner.cta')}
      </button>
    </div>
  );
}
