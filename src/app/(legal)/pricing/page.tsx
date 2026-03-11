'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Star, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanType } from '@/lib/plans';

interface SubscriptionInfo {
  plan: string;
  status: string;
  period_end: string;
  canceled_at: string | null;
}

interface RefundCheck {
  refundable: boolean;
  amount?: number;
  remainingHours?: number;
  reason?: string;
}

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

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [refundCheck, setRefundCheck] = useState<RefundCheck | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);

  const fetchSubscription = async (token: string) => {
    const res = await fetch('/api/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentPlan(data.plan || 'free');
      setSubscription(data.subscription);
      // Check refund eligibility if active subscription
      if (data.subscription?.status === 'active') {
        const refundRes = await fetch('/api/payments/refund-check', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refundRes.ok) setRefundCheck(await refundRes.json());
      }
    }
  };

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        await fetchSubscription(session.access_token);
      }
    };
    check();
  }, []);

  const handleCancel = async () => {
    setCancelLoading(true);
    setActionMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다.');
      const res = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(data.message);
      setShowCancelConfirm(false);
      await fetchSubscription(session.access_token);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : '해지에 실패했습니다.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRefund = async () => {
    setRefundLoading(true);
    setActionMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다.');
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(data.message);
      setShowRefundConfirm(false);
      await fetchSubscription(session.access_token);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : '환불에 실패했습니다.');
    } finally {
      setRefundLoading(false);
    }
  };

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

      {/* Subscription Management */}
      {isLoggedIn && subscription && (subscription.status === 'active' || subscription.status === 'canceled') && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">구독 관리</h2>
          <div className="rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">현재 플랜</span>
              <span className="font-semibold text-gray-900">{PLANS[subscription.plan as PlanType]?.name || subscription.plan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">상태</span>
              <span className={`font-semibold ${subscription.status === 'active' ? 'text-green-600' : 'text-orange-500'}`}>
                {subscription.status === 'active' ? '이용 중' : '해지됨'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">이용 기간</span>
              <span className="text-gray-700">{new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지</span>
            </div>

            {actionMessage && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">{actionMessage}</div>
            )}

            {subscription.status === 'active' && (
              <div className="pt-2 space-y-2">
                {/* Refund Button */}
                {refundCheck?.refundable && (
                  <>
                    {!showRefundConfirm ? (
                      <button
                        onClick={() => setShowRefundConfirm(true)}
                        className="w-full py-2.5 rounded-full text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        환불 요청 ({refundCheck.amount?.toLocaleString()}원)
                      </button>
                    ) : (
                      <div className="p-4 bg-red-50 rounded-xl space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-700">환불하시겠습니까?</p>
                            <p className="text-xs text-red-500 mt-1">
                              {refundCheck.amount?.toLocaleString()}원이 환불되며 즉시 무료 플랜으로 전환됩니다.
                              남은 환불 가능 시간: {refundCheck.remainingHours}시간
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowRefundConfirm(false)}
                            className="flex-1 py-2 rounded-full text-xs border border-gray-200 text-gray-500"
                          >취소</button>
                          <button
                            onClick={handleRefund}
                            disabled={refundLoading}
                            className="flex-1 py-2 rounded-full text-xs bg-red-500 text-white font-medium disabled:opacity-50"
                          >{refundLoading ? '처리 중...' : '환불 확인'}</button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Cancel Button */}
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full py-2.5 rounded-full text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    구독 해지
                  </button>
                ) : (
                  <div className="p-4 bg-orange-50 rounded-xl space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-700">구독을 해지하시겠습니까?</p>
                        <p className="text-xs text-orange-500 mt-1">
                          {new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 무료 플랜으로 전환됩니다.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="flex-1 py-2 rounded-full text-xs border border-gray-200 text-gray-500"
                      >취소</button>
                      <button
                        onClick={handleCancel}
                        disabled={cancelLoading}
                        className="flex-1 py-2 rounded-full text-xs bg-orange-500 text-white font-medium disabled:opacity-50"
                      >{cancelLoading ? '처리 중...' : '해지 확인'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {subscription.status === 'canceled' && (
              <p className="text-xs text-gray-400 pt-1">
                {new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지 이용 가능합니다.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center pb-4">
        결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
    </div>
  );
}
