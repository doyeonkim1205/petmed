'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Crown, RefreshCw, Calendar, CreditCard, Shield,
  AlertTriangle, Loader2, Zap, Check, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, type PlanType } from '@/lib/plans';

// ── Types ──

interface SubscriptionInfo {
  plan: string;
  status: string;
  billing_type?: 'recurring' | 'one_time';
  period_end: string;
  next_billing_at?: string | null;
  canceled_at: string | null;
  card_company?: string | null;
  card_number?: string | null;
  product_id?: string | null;
}

interface RefundCheck {
  refundable: boolean;
  amount?: number;
  remainingHours?: number;
}

// ── Feature comparison data ──

const planOrder: PlanType[] = ['free', 'plus'];

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
        label: '논문 저장', key: 'saved',
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

// ── Page Component ──

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [refundCheck, setRefundCheck] = useState<RefundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [showDisableAutoRenewConfirm, setShowDisableAutoRenewConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const token = session.access_token;
    const res = await fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setSubscription(data.subscription);
      if (data.subscription?.status === 'active') {
        const refundRes = await fetch('/api/payments/refund-check', { headers: { Authorization: `Bearer ${token}` } });
        if (refundRes.ok) setRefundCheck(await refundRes.json());
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchData();
  }, [user, authLoading, router]);

  const callApi = async (path: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('세션이 만료되었습니다.');
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  const handleAction = async (key: string, fn: () => Promise<{ message?: string }>) => {
    setActionLoading(key);
    setActionMessage('');
    try {
      const result = await fn();
      setActionMessage(result.message || '처리되었습니다.');
      setShowCancelConfirm(false);
      setShowRefundConfirm(false);
      setShowDisableAutoRenewConfirm(false);
      await fetchData();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : '처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubscribe = () => {
    const productId = billingPeriod === 'yearly' ? 'plus_yearly' : 'plus_monthly';
    router.push(`/payment?productId=${productId}`);
  };

  const currentPlan = profile?.plan || 'free';
  const isPaid = currentPlan !== 'free';
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const isRecurring = subscription?.billing_type === 'recurring';
  const hasSub = isActive || isCanceled;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header — 뒤로 = 항상 프로필 */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10 border-b border-gray-100">
        <button onClick={() => router.push('/profile')} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">구독/결제 관리</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-5">

        {/* ── 1. Plan Card ── */}
        <div className={`rounded-2xl border p-4 mb-5 ${
          isPaid ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {isPaid
                  ? <Crown size={15} className="text-blue-500" />
                  : <Zap size={15} className="text-gray-400" />}
                <span className={`text-base font-bold ${isPaid ? 'text-blue-700' : 'text-gray-700'}`}>
                  {isPaid ? 'Plus' : 'Free'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                {isPaid ? '모든 기능을 제한 없이' : '기본 기능 무료 이용'}
              </p>
            </div>
            {hasSub && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-orange-400'}`} />
                {isActive ? '이용 중' : '해지됨'}
              </span>
            )}
          </div>
        </div>

        {/* ── 2. Subscription Details ── */}
        {hasSub && subscription && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <span className="text-[10px] font-semibold text-gray-400 tracking-wider">구독 정보</span>
            </div>
            <div className="divide-y divide-gray-50">
              <DetailRow
                icon={<RefreshCw size={13} className={isRecurring ? 'text-blue-500' : 'text-gray-400'} />}
                label="결제 방식"
                value={isRecurring ? '자동 갱신' : '1회 결제'}
                accent={isRecurring}
              />
              <DetailRow
                icon={<Calendar size={13} className="text-gray-400" />}
                label="이용 기간"
                value={`${new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지`}
              />
              {isRecurring && subscription.next_billing_at && (
                <DetailRow
                  icon={<CreditCard size={13} className="text-blue-500" />}
                  label="다음 결제일"
                  value={new Date(subscription.next_billing_at).toLocaleDateString('ko-KR')}
                  accent
                />
              )}
              {isRecurring && subscription.card_number && (
                <DetailRow
                  icon={<Shield size={13} className="text-gray-400" />}
                  label="결제 카드"
                  value={`${subscription.card_company || ''} ${subscription.card_number}`.trim()}
                />
              )}
            </div>
          </div>
        )}

        {/* ── 3. Action Message ── */}
        {actionMessage && (
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 mb-4 leading-relaxed">{actionMessage}</div>
        )}

        {/* ── 4. Action Buttons ── */}
        <div className="space-y-2 mb-8">
          {/* Recurring: card change */}
          {isActive && isRecurring && (
            <button
              onClick={() => {
                const pid = subscription?.product_id || 'plus_monthly';
                router.push(`/payment/billing-auth?productId=${pid}`);
              }}
              className="w-full py-3 rounded-2xl text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              결제 카드 변경
            </button>
          )}

          {/* Recurring: disable auto-renewal */}
          {isActive && isRecurring && !showDisableAutoRenewConfirm && (
            <button
              onClick={() => setShowDisableAutoRenewConfirm(true)}
              className="w-full py-3 rounded-2xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              자동 갱신 끄기
            </button>
          )}
          {showDisableAutoRenewConfirm && (
            <ConfirmCard
              color="gray"
              title="자동 갱신을 끄시겠습니까?"
              description={`${new Date(subscription!.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 자동 결제가 중지됩니다.`}
              confirmLabel="자동 갱신 끄기"
              loading={actionLoading === 'disableAutoRenew'}
              onCancel={() => setShowDisableAutoRenewConfirm(false)}
              onConfirm={() => handleAction('disableAutoRenew', () => callApi('/api/payments/billing/disable'))}
            />
          )}

          {/* Refund */}
          {isActive && refundCheck?.refundable && !showRefundConfirm && (
            <button
              onClick={() => setShowRefundConfirm(true)}
              className="w-full py-3 rounded-2xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              환불 요청 ({refundCheck.amount?.toLocaleString()}원)
            </button>
          )}
          {showRefundConfirm && refundCheck && (
            <ConfirmCard
              color="red"
              title="환불하시겠습니까?"
              description={`${refundCheck.amount?.toLocaleString()}원이 환불되며 즉시 무료 플랜으로 전환됩니다. (남은 시간: ${refundCheck.remainingHours}시간)`}
              confirmLabel="환불 확인"
              loading={actionLoading === 'refund'}
              onCancel={() => setShowRefundConfirm(false)}
              onConfirm={() => handleAction('refund', () => callApi('/api/payments/refund'))}
            />
          )}

          {/* Cancel subscription */}
          {isActive && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-3 rounded-2xl text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              구독 해지
            </button>
          )}
          {showCancelConfirm && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-orange-700">구독을 해지하시겠습니까?</p>
                  <p className="text-[11px] text-orange-500/80 mt-1 leading-relaxed">
                    {new Date(subscription!.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 무료 플랜으로 전환됩니다.
                    {isRecurring && ' 자동 결제도 중지됩니다.'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-orange-600/70 mb-2">해지 사유 (선택)</p>
                <div className="flex flex-wrap gap-1.5">
                  {['가격이 부담돼요', '사용 빈도가 낮아요', '필요한 기능이 없어요', '다른 서비스를 이용해요'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setCancelReason(cancelReason === r ? '' : r)}
                      className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                        cancelReason === r ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'
                      }`}
                    >{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}
                  className="flex-1 py-2.5 rounded-xl text-[11px] border border-gray-200 text-gray-500">취소</button>
                <button
                  onClick={() => handleAction('cancel', () => callApi('/api/payments/cancel', { reason: cancelReason || undefined }))}
                  disabled={actionLoading === 'cancel'}
                  className="flex-1 py-2.5 rounded-xl text-[11px] bg-orange-500 text-white font-medium disabled:opacity-50"
                >{actionLoading === 'cancel' ? '처리 중...' : '해지 확인'}</button>
              </div>
            </div>
          )}

          {/* Monthly → Yearly upgrade */}
          {isActive && !subscription?.product_id?.includes('yearly') && (
            <button
              onClick={() => router.push('/payment?productId=plus_yearly')}
              className="w-full py-3 rounded-2xl text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-between px-4"
            >
              <span>연간으로 변경</span>
              <span className="text-[10px] text-blue-400">40,000원/년 (14.5% 할인)</span>
            </button>
          )}
        </div>

        {/* ── 5. Feature Comparison ── */}
        <div className="border-t border-gray-100 pt-6 mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4">기능 비교</h2>

          {/* Billing period toggle — show when user can (re)subscribe */}
          {(!isPaid || isCanceled) && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex bg-gray-100 rounded-full p-0.5">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                    billingPeriod === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}>월간</button>
                <button
                  onClick={() => setBillingPeriod('yearly')}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                    billingPeriod === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}>
                  연간
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">-14.5%</span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-gray-400 font-medium w-[35%]"></th>
                  {planOrder.map((p) => (
                    <th key={p} className={`text-center py-2.5 px-2 font-bold ${
                      p === 'plus' ? 'text-blue-600' : 'text-gray-500'
                    }`}>{PLANS[p].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureGroups.map((group) => (
                  <>
                    <tr key={`g-${group.title}`} className="bg-gray-50/80">
                      <td colSpan={3} className="py-1.5 px-3 text-[10px] font-bold text-gray-400 tracking-wider">
                        {group.title}
                      </td>
                    </tr>
                    {group.features.map((feat) => (
                      <tr key={feat.key} className="border-t border-gray-100 bg-white">
                        <td className="py-2 px-3 text-gray-600">{feat.label}</td>
                        {planOrder.map((p) => {
                          const isUnavailable = feat.unavailable?.(p);
                          const text = feat.format(p);
                          const isBetter = p !== 'free' && !isUnavailable;
                          return (
                            <td key={p} className={`py-2 px-2 text-center ${
                              isUnavailable ? 'text-gray-300' : isBetter ? 'text-gray-900 font-semibold' : 'text-gray-500'
                            }`}>
                              {isUnavailable ? <X size={11} className="inline text-gray-300" /> : text}
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

          {/* Subscribe CTA (non-subscriber) */}
          {!isPaid && !hasSub && (
            <div className="mt-4">
              <button
                onClick={handleSubscribe}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Crown size={15} />
                Plus 시작하기
                <span className="text-xs text-blue-200">
                  {billingPeriod === 'yearly'
                    ? `${Math.round(YEARLY_PRICE / 12).toLocaleString()}원/월`
                    : `${MONTHLY_PRICE.toLocaleString()}원/월`}
                </span>
              </button>
              {billingPeriod === 'yearly' && (
                <p className="text-center text-[10px] text-gray-400 mt-1.5">
                  연 {YEARLY_PRICE.toLocaleString()}원 (월간 대비 {(MONTHLY_PRICE * 12 - YEARLY_PRICE).toLocaleString()}원 할인)
                </p>
              )}
            </div>
          )}

          {/* Re-subscribe CTA (canceled/expired) */}
          {(isCanceled || (!isPaid && hasSub)) && (
            <div className="mt-4">
              <button
                onClick={handleSubscribe}

                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Crown size={15} />
                다시 구독하기
                <span className="text-xs text-blue-200">
                  {billingPeriod === 'yearly'
                    ? `${Math.round(YEARLY_PRICE / 12).toLocaleString()}원/월`
                    : `${MONTHLY_PRICE.toLocaleString()}원/월`}
                </span>
              </button>
              {billingPeriod === 'yearly' && (
                <p className="text-center text-[10px] text-gray-400 mt-1.5">
                  연 {YEARLY_PRICE.toLocaleString()}원 (월간 대비 {(MONTHLY_PRICE * 12 - YEARLY_PRICE).toLocaleString()}원 할인)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-[10px] text-gray-300">
            결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-400">dylabs.pawdex@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function DetailRow({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] text-gray-500">{label}</span>
      </div>
      <span className={`text-[11px] font-semibold ${accent ? 'text-blue-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function ConfirmCard({ color, title, description, confirmLabel, loading, onCancel, onConfirm }: {
  color: 'gray' | 'red'; title: string; description: string; confirmLabel: string;
  loading: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const bg = color === 'red' ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100';
  const iconColor = color === 'red' ? 'text-red-400' : 'text-gray-400';
  const titleColor = color === 'red' ? 'text-red-700' : 'text-gray-700';
  const descColor = color === 'red' ? 'text-red-500/80' : 'text-gray-500';
  const btnBg = color === 'red' ? 'bg-red-500' : 'bg-gray-700';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${bg}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={14} className={`${iconColor} mt-0.5 flex-shrink-0`} />
        <div>
          <p className={`text-xs font-semibold ${titleColor}`}>{title}</p>
          <p className={`text-[11px] ${descColor} mt-1 leading-relaxed`}>{description}</p>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[11px] border border-gray-200 text-gray-500">취소</button>
        <button onClick={onConfirm} disabled={loading}
          className={`flex-1 py-2.5 rounded-xl text-[11px] text-white font-medium disabled:opacity-50 ${btnBg}`}>
          {loading ? '처리 중...' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
