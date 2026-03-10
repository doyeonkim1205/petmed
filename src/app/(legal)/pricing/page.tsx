'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Star, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanType } from '@/lib/plans';

const planOrder: PlanType[] = ['free', 'basic', 'premium'];

const planMeta: Record<PlanType, {
  tagline: string;
  highlights: string[];
  badge: string;
  border: string;
  button: string;
  icon: React.ReactNode | null;
  headerBg: string;
}> = {
  free: {
    tagline: '기본 기능을 무료로',
    highlights: ['논문 검색 3회/일', '증상 검색 2회/일', '건강 기록 10개'],
    badge: 'bg-gray-100 text-gray-500',
    border: 'border-gray-200',
    button: '',
    icon: null,
    headerBg: 'bg-gray-50',
  },
  basic: {
    tagline: '반려동물 건강관리의 시작',
    highlights: ['논문 검색 10회/일', '증상 검색 5회/일', 'AI 상세 분석', '논문 저장 10개'],
    badge: 'bg-blue-50 text-blue-600',
    border: 'border-blue-200 ring-1 ring-blue-100',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    icon: <Star size={14} />,
    headerBg: 'bg-blue-50',
  },
  premium: {
    tagline: '모든 기능을 제한 없이',
    highlights: ['논문 검색 15회/일', '증상 검색 10회/일', '건강 기록 100개', '첨부 5개 · 저장 1GB'],
    badge: 'bg-purple-50 text-purple-600',
    border: 'border-purple-200 ring-1 ring-purple-100',
    button: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
    icon: <Crown size={14} />,
    headerBg: 'bg-purple-50',
  },
};

interface FeatureRow {
  label: string;
  values: Record<PlanType, string>;
  highlight?: PlanType[];
}

const comparisonRows: FeatureRow[] = [
  {
    label: '논문 검색',
    values: { free: '3회/일', basic: '10회/일', premium: '15회/일' },
    highlight: ['basic', 'premium'],
  },
  {
    label: '증상 검색',
    values: { free: '2회/일', basic: '5회/일', premium: '10회/일' },
    highlight: ['basic', 'premium'],
  },
  {
    label: '증상 재분석',
    values: { free: '1회/일', basic: '3회/일', premium: '5회/일' },
    highlight: ['basic', 'premium'],
  },
  {
    label: 'AI 분석',
    values: { free: '미리보기', basic: '상세 분석', premium: '상세 분석' },
    highlight: ['basic', 'premium'],
  },
  {
    label: '건강 기록',
    values: { free: '10개', basic: '30개', premium: '100개' },
    highlight: ['premium'],
  },
  {
    label: '논문 저장',
    values: { free: '-', basic: '10개', premium: '50개' },
    highlight: ['basic', 'premium'],
  },
  {
    label: '반려동물',
    values: { free: '2마리', basic: '3마리', premium: '5마리' },
  },
  {
    label: '첨부파일',
    values: { free: '1개/기록', basic: '3개/기록', premium: '5개/기록' },
  },
  {
    label: '저장 용량',
    values: { free: '50MB', basic: '200MB', premium: '1GB' },
    highlight: ['premium'],
  },
  {
    label: '비용 통계',
    values: { free: '이번 달', basic: '6개월', premium: '1년' },
  },
  {
    label: '동시 접속',
    values: { free: '1대', basic: '2대', premium: '3대' },
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTable, setShowTable] = useState(false);

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

      {/* Plan Cards - Compact */}
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
              {/* Header */}
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
                          <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                            현재
                          </span>
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
                        <span className="text-xl font-extrabold text-gray-900">
                          {plan.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 ml-0.5">원/월</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="px-5 py-3 bg-white">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {meta.highlights.map((h) => (
                    <span key={h} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Check size={12} className="text-green-500 flex-shrink-0" />
                      {h}
                    </span>
                  ))}
                </div>

                {planKey !== 'free' && !isCurrent && (
                  <button
                    onClick={() => handleSubscribe(planKey)}
                    className={`w-full mt-3 py-2.5 rounded-full text-sm font-semibold transition-colors ${meta.button}`}
                  >
                    {plan.name} 시작하기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table Toggle */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        전체 기능 비교
        <ChevronDown size={16} className={`transition-transform ${showTable ? 'rotate-180' : ''}`} />
      </button>

      {showTable && (
        <div className="mt-2 mb-8 rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-400 font-medium w-[30%]">기능</th>
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
              {comparisonRows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-2.5 px-4 text-gray-500 font-medium">{row.label}</td>
                  {planOrder.map((p) => {
                    const isHighlighted = row.highlight?.includes(p);
                    const isUnavailable = row.values[p] === '-';
                    return (
                      <td key={p} className={`py-2.5 px-2 text-center ${
                        isUnavailable ? 'text-gray-300' :
                        isHighlighted ? 'text-gray-900 font-semibold' :
                        'text-gray-500'
                      }`}>
                        {isUnavailable ? <X size={12} className="inline text-gray-300" /> : row.values[p]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center pb-4">
        결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
    </div>
  );
}
