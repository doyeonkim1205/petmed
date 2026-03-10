'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Star, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanType } from '@/lib/plans';

const planOrder: PlanType[] = ['free', 'basic', 'premium'];

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
  basic: {
    tagline: '반려동물 건강관리의 시작',
    badge: 'bg-blue-50 text-blue-600',
    border: 'border-blue-200 ring-1 ring-blue-100',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: <Star size={14} />,
    headerBg: 'bg-blue-50',
  },
  premium: {
    tagline: '모든 기능을 제한 없이',
    badge: 'bg-purple-50 text-purple-600',
    border: 'border-purple-200 ring-1 ring-purple-100',
    button: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
    icon: <Crown size={14} />,
    headerBg: 'bg-purple-50',
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
    ],
  },
  {
    title: '총 한도',
    features: [
      { label: '건강 기록', key: 'records', format: (p) => `최대 ${PLANS[p].maxRecords}개` },
      {
        label: '논문 저장',
        key: 'saved',
        format: (p) => p === 'free' ? '-' : `최대 ${PLANS[p].maxSavedAnalyses}개`,
        unavailable: (p) => p === 'free',
      },
      { label: '반려동물', key: 'pets', format: (p) => `최대 ${PLANS[p].maxPets}마리` },
      { label: '첨부파일', key: 'attach', format: (p) => `기록당 ${PLANS[p].attachmentsPerRecord}개` },
      { label: '저장 용량', key: 'storage', format: (p) => `총 ${PLANS[p].maxStorageMB >= 1000 ? `${PLANS[p].maxStorageMB / 1000}GB` : `${PLANS[p].maxStorageMB}MB`}` },
    ],
  },
  {
    title: '기능',
    features: [
      { label: 'AI 분석', key: 'ai', format: (p) => PLANS[p].aiAnalysis === 'blur' ? '미리보기' : '상세 분석' },
      { label: '비용 통계', key: 'cost', format: (p) => PLANS[p].costStatsMonths === 1 ? '이번 달' : PLANS[p].costStatsMonths === 12 ? '1년' : `${PLANS[p].costStatsMonths}개월` },
      { label: '동시 접속', key: 'devices', format: (p) => `${PLANS[p].maxDevices}대` },
    ],
  },
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
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">요금제</h1>
      <p className="text-sm text-gray-400 mb-6">
        나에게 맞는 플랜을 선택하세요.
      </p>

      {/* Plan Cards */}
      <div className="space-y-3 mb-8">
        {planOrder.map((planKey) => {
          const plan = PLANS[planKey];
          const meta = planMeta[planKey];
          const isCurrent = currentPlan === planKey;

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
                    {plan.price === 0 ? (
                      <span className="text-xl font-extrabold text-gray-900">무료</span>
                    ) : (
                      <div>
                        <span className="text-xl font-extrabold text-gray-900">{plan.price.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-0.5">원/월</span>
                      </div>
                    )}
                  </div>
                </div>
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
                  p === 'premium' ? 'text-purple-600' : p === 'basic' ? 'text-blue-600' : 'text-gray-500'
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

      <p className="text-[11px] text-gray-400 text-center pb-4">
        결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
    </div>
  );
}
