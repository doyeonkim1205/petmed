'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Star, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanType } from '@/lib/plans';

const planOrder: PlanType[] = ['free', 'basic', 'premium'];

const planStyles: Record<PlanType, { badge: string; border: string; button: string; icon: React.ReactNode }> = {
  free: {
    badge: 'bg-gray-100 text-gray-500',
    border: 'border-gray-200',
    button: 'bg-gray-100 text-gray-500',
    icon: null,
  },
  basic: {
    badge: 'bg-blue-50 text-blue-600',
    border: 'border-blue-300 ring-1 ring-blue-100',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: <Star size={16} />,
  },
  premium: {
    badge: 'bg-purple-50 text-purple-600',
    border: 'border-purple-300 ring-1 ring-purple-100',
    button: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
    icon: <Crown size={16} />,
  },
};

const features = [
  { label: '건강 기록장', key: 'maxRecords' as const, format: (v: number, plan: PlanType) => v === 0 ? '무제한' : `${v}개` },
  { label: '논문 검색', key: 'searchPerDay' as const, format: (v: number, plan: PlanType) => `${v}회/일` },
  { label: 'AI 분석', key: 'aiAnalysis' as const, format: (v: string, plan: PlanType) => v === 'blur' ? '블러(미리보기)' : '상세 분석' },
  { label: '논문 저장', key: 'maxSavedAnalyses' as const, format: (v: number, plan: PlanType) => plan === 'free' ? '불가' : v === 0 ? '무제한' : `${v}개` },
  { label: '비용 통계', key: 'costStatsMonths' as const, format: (v: number, plan: PlanType) => v === 1 ? '이번 달' : v === 12 ? '1년' : `${v}개월` },
  { label: '반려동물', key: 'maxPets' as const, format: (v: number, plan: PlanType) => v === 0 ? '무제한' : `${v}마리` },
  { label: '첨부파일', key: 'attachmentsPerRecord' as const, format: (v: number, plan: PlanType) => `기록당 ${v}개` },
];

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
        setCurrentPlan(data?.plan || 'free');
      }
    };
    check();
  }, []);

  const handleSubscribe = (plan: PlanType) => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    if (plan === 'free') return;
    router.push(`/payment?plan=${plan}`);
  };

  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">요금제</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        PawDex의 다양한 기능을 합리적인 가격으로 이용하세요.
      </p>

      {/* Plan Cards */}
      <div className="space-y-4 mb-10">
        {planOrder.map((planKey) => {
          const plan = PLANS[planKey];
          const style = planStyles[planKey];
          const isCurrent = currentPlan === planKey;

          return (
            <div
              key={planKey}
              className={`rounded-2xl border p-5 ${style.border} ${isCurrent ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {style.icon && <span className={style.badge + ' p-1 rounded-full'}>{style.icon}</span>}
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">현재 플랜</span>
                  )}
                </div>
                <div className="text-right">
                  {plan.price === 0 ? (
                    <span className="text-lg font-bold text-gray-900 dark:text-white">무료</span>
                  ) : (
                    <div>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">₩{plan.price.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">/월</span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-4">
                {features.map((feat) => {
                  const value = plan[feat.key];
                  const isUnavailable = planKey === 'free' && feat.key === 'maxSavedAnalyses';
                  return (
                    <li key={feat.key} className="flex items-center gap-2 text-sm">
                      {isUnavailable ? (
                        <X size={14} className="text-gray-300" />
                      ) : (
                        <Check size={14} className="text-green-500" />
                      )}
                      <span className={`${isUnavailable ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                        {feat.label}: {(feat.format as (v: any, p: PlanType) => string)(value, planKey)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {planKey !== 'free' && !isCurrent && (
                <button
                  onClick={() => handleSubscribe(planKey)}
                  className={`w-full py-2.5 rounded-full text-sm font-medium transition-colors ${style.button}`}
                >
                  {plan.name} 구독하기
                </button>
              )}
              {isCurrent && planKey !== 'free' && (
                <p className="text-center text-xs text-gray-400">현재 이용 중인 플랜입니다</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">기능 비교</h2>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm border-collapse min-w-[400px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-xs text-gray-400 font-medium">기능</th>
              {planOrder.map((p) => (
                <th key={p} className="text-center py-2 text-xs font-bold text-gray-700 dark:text-gray-200">
                  {PLANS[p].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feat) => (
              <tr key={feat.key} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2.5 text-xs text-gray-500">{feat.label}</td>
                {planOrder.map((p) => {
                  const text = (feat.format as (v: any, plan: PlanType) => string)(PLANS[p][feat.key], p);
                  const isUnavailable = p === 'free' && feat.key === 'maxSavedAnalyses';
                  return (
                    <td key={p} className={`py-2.5 text-center text-xs ${isUnavailable ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        결제 관련 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
    </article>
  );
}
