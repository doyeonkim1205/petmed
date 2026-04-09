'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanType } from '@/lib/plans';

const planOrder: PlanType[] = ['free', 'plus'];

const planMeta: Record<PlanType, {
  tagline: string;
  badge: string;
  border: string;
  button: string;
  icon: React.ReactNode | null;
  headerBg: string;
}> = {
  free: {
    tagline: '기본 기능을 무료로',
    badge: 'bg-gray-100 text-gray-500',
    border: 'border-gray-200',
    button: '',
    icon: null,
    headerBg: 'bg-gray-50',
  },
  plus: {
    tagline: '모든 기능을 제한 없이',
    badge: 'bg-blue-50 text-blue-600',
    border: 'border-blue-200 ring-1 ring-blue-100',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: <Crown size={14} />,
    headerBg: 'bg-blue-50',
  },
};

interface FeatureItem {
  label: string;
  key: string;
  format: (plan: PlanType) => string;
  unavailable?: (plan: PlanType) => boolean;
}

const featureGroups: { title: string; features: FeatureItem[] }[] = [
  {
    title: '일일 한도',
    features: [
      { label: '논문 검색', key: 'search', format: (p) => `${PLANS[p].searchPerDay}회/일` },
      { label: '증상 검색', key: 'symptom', format: (p) => `${PLANS[p].symptomSearchPerDay}회/일` },
      { label: '증상 재분석', key: 'refine', format: (p) => `${PLANS[p].symptomRefinePerDay}회/일` },
      { label: '증상 입력', key: 'symptomLen', format: (p) => `최대 ${PLANS[p].maxSymptomLength}자` },
    ],
  },
  {
    title: '총 한도',
    features: [
      { label: '건강 기록', key: 'records', format: (p) => PLANS[p].maxRecords === 0 ? '무제한' : `최대 ${PLANS[p].maxRecords}개` },
      {
        label: '논문 저장',
        key: 'saved',
        format: (p) => p === 'free' ? '-' : PLANS[p].maxSavedAnalyses === 0 ? '무제한' : `최대 ${PLANS[p].maxSavedAnalyses}개`,
        unavailable: (p) => p === 'free',
      },
      { label: '반려동물', key: 'pets', format: (p) => PLANS[p].maxPets === 0 ? '무제한' : `최대 ${PLANS[p].maxPets}마리` },
      { label: '첨부파일', key: 'attach', format: (p) => `기록당 ${PLANS[p].attachmentsPerRecord}개` },
      { label: '저장 용량', key: 'storage', format: (p) => `총 ${PLANS[p].maxStorageMB >= 1000 ? `${PLANS[p].maxStorageMB / 1000}GB` : `${PLANS[p].maxStorageMB}MB`}` },
    ],
  },
  {
    title: '기능',
    features: [
      { label: '비용 통계', key: 'cost', format: (p) => PLANS[p].costStatsMonths === 1 ? '이번 달' : PLANS[p].costStatsMonths === 12 ? '1년' : `${PLANS[p].costStatsMonths}개월` },
      { label: '동시 접속', key: 'devices', format: (p) => `${PLANS[p].maxDevices}대` },
    ],
  },
];

type BillingPeriod = 'monthly' | 'yearly';

const YEARLY_PRICE = 40000;
const MONTHLY_PRICE = 3900;

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Logged-in users go to the unified subscription management page
        router.replace('/profile/subscription');
        return;
      }
    };
    check();
  }, [router]);

  const handleSubscribe = (plan: PlanType) => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    if (plan === 'free') return;
    const productId = billingPeriod === 'yearly' ? `${plan}_yearly` : `${plan}_monthly`;
    router.push(`/payment?productId=${productId}`);
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">요금제</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-5">
      <h2 className="text-xl font-bold text-gray-900 mb-1">요금제</h2>
      <p className="text-sm text-gray-400 mb-6">
        나에게 맞는 플랜을 선택하세요.
      </p>

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            월간 결제
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              billingPeriod === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            연간 결제
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">
              -14%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="space-y-3 mb-8">
        {planOrder.map((planKey) => {
          const plan = PLANS[planKey];
          const meta = planMeta[planKey];
          const isCurrent = currentPlan === planKey;
          const isYearly = billingPeriod === 'yearly';
          const isPaidPlan = planKey !== 'free';

          // For paid plans the displayed price depends on the billing period
          // (monthly vs yearly). For free plan we always show 무료.
          const displayMonthly = isPaidPlan
            ? isYearly
              ? Math.round(YEARLY_PRICE / 12)
              : MONTHLY_PRICE
            : 0;
          const yearlySavings = isPaidPlan && isYearly
            ? MONTHLY_PRICE * 12 - YEARLY_PRICE
            : 0;

          return (
            <div
              key={planKey}
              className={`rounded-2xl border overflow-hidden ${meta.border} ${isCurrent ? 'ring-2 ring-offset-1' : ''}`}
            >
              <div className={`px-5 py-4 ${meta.headerBg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {meta.icon && (
                      <span className={`${meta.badge} p-1.5 rounded-full`}>{meta.icon}</span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">현재</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.tagline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {!isPaidPlan ? (
                      <span className="text-xl font-extrabold text-gray-900">무료</span>
                    ) : (
                      <div>
                        <div>
                          <span className="text-xl font-extrabold text-gray-900">{displayMonthly.toLocaleString()}</span>
                          <span className="text-xs text-gray-400 ml-0.5">원/월</span>
                        </div>
                        {isYearly && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            연 {YEARLY_PRICE.toLocaleString()}원
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isPaidPlan && isYearly && yearlySavings > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    연간 결제 시 {yearlySavings.toLocaleString()}원 할인
                  </div>
                )}
              </div>

              {planKey !== 'free' && !isCurrent && (
                <div className="px-5 py-3 bg-white">
                  <button
                    onClick={() => handleSubscribe(planKey)}
                    className={`w-full py-2.5 rounded-full text-sm font-semibold transition-colors ${meta.button}`}
                  >
                    {plan.name} 시작하기
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table - Grouped */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">기능 비교</h2>
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 text-gray-400 font-medium w-[30%]"></th>
              {planOrder.map((p) => (
                <th key={p} className={`text-center py-3 px-2 font-bold ${
                  p === 'plus' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {PLANS[p].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureGroups.map((group) => (
              <>
                <tr key={`group-${group.title}`} className="bg-gray-50/80">
                  <td colSpan={4} className="py-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    {group.title}
                  </td>
                </tr>
                {group.features.map((feat) => (
                  <tr key={feat.key} className="border-t border-gray-100 bg-white">
                    <td className="py-2.5 px-4 text-gray-600">{feat.label}</td>
                    {planOrder.map((p) => {
                      const isUnavailable = feat.unavailable?.(p);
                      const text = feat.format(p);
                      const isBetter = p !== 'free' && !isUnavailable;
                      return (
                        <td key={p} className={`py-2.5 px-2 text-center ${
                          isUnavailable ? 'text-gray-300' :
                          isBetter ? 'text-gray-900 font-semibold' :
                          'text-gray-500'
                        }`}>
                          {isUnavailable ? <X size={12} className="inline text-gray-300" /> : text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subscription management link */}
      {isLoggedIn && (
        <div className="mb-6 text-center">
          <button
            onClick={() => router.push('/profile/subscription')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            구독/결제 관리 →
          </button>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center pb-4">
        결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
      </div>{/* end px-4 */}
    </div>
  );
}
