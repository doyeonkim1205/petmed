'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CreditCard, Crown, RefreshCw, Calendar, Shield,
  AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, type PlanType } from '@/lib/plans';

interface SubscriptionInfo {
  plan: string;
  status: string;
  billing_type?: 'recurring' | 'one_time';
  period_start?: string;
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

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [refundCheck, setRefundCheck] = useState<RefundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirm modals
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [showDisableAutoRenewConfirm, setShowDisableAutoRenewConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const token = session.access_token;

    const res = await fetch('/api/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSubscription(data.subscription);
      if (data.subscription?.status === 'active') {
        const refundRes = await fetch('/api/payments/refund-check', {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
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
      setActionMessage(result.message || '처리 완료');
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

  const currentPlan = profile?.plan || 'free';
  const planConfig = PLANS[currentPlan as PlanType] || PLANS.free;
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const isExpired = subscription?.status === 'expired';
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
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <ArrowLeft size={16} /> 돌아가기
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-6">구독 관리</h1>

      {/* Current Plan Badge */}
      <div className={`rounded-2xl p-5 mb-6 ${currentPlan !== 'free' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {currentPlan !== 'free' && <Crown size={18} className="text-blue-500" />}
            <span className="text-lg font-bold text-gray-900">{planConfig.name}</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            isActive ? 'bg-green-100 text-green-700' :
            isCanceled ? 'bg-orange-100 text-orange-700' :
            isExpired ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {isActive ? '이용 중' : isCanceled ? '해지됨' : isExpired ? '만료됨' : '무료'}
          </span>
        </div>
        {currentPlan !== 'free' && (
          <p className="text-xs text-gray-500">
            {planConfig.price.toLocaleString()}원/월 · 무제한 기록 · 15회/일 검색
          </p>
        )}
      </div>

      {/* Subscription Details */}
      {hasSub && subscription && (
        <div className="rounded-xl border border-gray-200 mb-6 divide-y divide-gray-100">
          <InfoRow icon={<CreditCard size={16} />} label="결제 방식"
            value={isRecurring ? '자동 갱신' : '1회 결제'}
            valueColor={isRecurring ? 'text-blue-600' : 'text-gray-700'} />
          <InfoRow icon={<Calendar size={16} />} label="이용 기간"
            value={`${new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지`} />
          {isRecurring && subscription.next_billing_at && (
            <InfoRow icon={<RefreshCw size={16} />} label="다음 결제일"
              value={new Date(subscription.next_billing_at).toLocaleDateString('ko-KR')} />
          )}
          {isRecurring && subscription.card_number && (
            <InfoRow icon={<Shield size={16} />} label="결제 카드"
              value={`${subscription.card_company || ''} ${subscription.card_number}`} />
          )}
        </div>
      )}

      {/* Action Message */}
      {actionMessage && (
        <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700 mb-4">{actionMessage}</div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">

        {/* Free → Subscribe */}
        {currentPlan === 'free' && !hasSub && (
          <ActionButton label="Plus 구독하기" primary onClick={() => router.push('/pricing')} />
        )}

        {/* Expired → Re-subscribe */}
        {(isExpired || (currentPlan === 'free' && !subscription)) && (
          <ActionButton label="다시 구독하기" primary onClick={() => router.push('/pricing')} />
        )}

        {/* Canceled → Re-subscribe (before expiry) */}
        {isCanceled && (
          <ActionButton label="다시 구독하기" primary onClick={() => router.push('/pricing')} />
        )}

        {/* Monthly → Change to yearly */}
        {isActive && subscription?.product_id?.includes('monthly') && (
          <ActionButton
            label="연간으로 변경 (40,000원/년)"
            onClick={() => router.push('/payment?productId=plus_yearly')}
            icon={<ChevronRight size={14} />}
          />
        )}

        {/* Change card (recurring only) */}
        {isActive && isRecurring && (
          <ActionButton
            label="결제 카드 변경"
            onClick={() => {
              const pid = subscription?.product_id || 'plus_monthly';
              router.push(`/payment/billing-auth?productId=${pid}`);
            }}
          />
        )}

        {/* Disable auto-renewal (recurring only) */}
        {isActive && isRecurring && !showDisableAutoRenewConfirm && (
          <ActionButton
            label="자동 갱신 끄기"
            muted
            onClick={() => setShowDisableAutoRenewConfirm(true)}
          />
        )}
        {showDisableAutoRenewConfirm && (
          <ConfirmBox
            icon={<AlertTriangle size={16} className="text-gray-400" />}
            title="자동 갱신을 끄시겠습니까?"
            description={`${new Date(subscription!.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 자동 결제가 중지됩니다.`}
            confirmLabel="자동 갱신 끄기"
            confirmColor="bg-gray-700"
            loading={actionLoading === 'disableAutoRenew'}
            onCancel={() => setShowDisableAutoRenewConfirm(false)}
            onConfirm={() => handleAction('disableAutoRenew', () => callApi('/api/payments/billing/disable'))}
          />
        )}

        {/* Refund */}
        {isActive && refundCheck?.refundable && !showRefundConfirm && (
          <ActionButton
            label={`환불 요청 (${refundCheck.amount?.toLocaleString()}원)`}
            danger
            onClick={() => setShowRefundConfirm(true)}
          />
        )}
        {showRefundConfirm && refundCheck && (
          <ConfirmBox
            icon={<AlertTriangle size={16} className="text-red-400" />}
            title="환불하시겠습니까?"
            description={`${refundCheck.amount?.toLocaleString()}원이 환불되며 즉시 무료 플랜으로 전환됩니다. 남은 환불 가능 시간: ${refundCheck.remainingHours}시간`}
            confirmLabel="환불 확인"
            confirmColor="bg-red-500"
            loading={actionLoading === 'refund'}
            onCancel={() => setShowRefundConfirm(false)}
            onConfirm={() => handleAction('refund', () => callApi('/api/payments/refund'))}
          />
        )}

        {/* Cancel subscription */}
        {isActive && !showCancelConfirm && (
          <ActionButton
            label="구독 해지"
            muted
            onClick={() => setShowCancelConfirm(true)}
          />
        )}
        {showCancelConfirm && (
          <div className="p-4 bg-orange-50 rounded-xl space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-700">구독을 해지하시겠습니까?</p>
                <p className="text-xs text-orange-500 mt-1">
                  {new Date(subscription!.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 무료 플랜으로 전환됩니다.
                  {isRecurring && ' 자동 결제도 중지됩니다.'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-orange-600 mb-2">해지 사유 (선택)</p>
              <div className="flex flex-wrap gap-1.5">
                {['가격이 부담돼요', '사용 빈도가 낮아요', '필요한 기능이 없어요', '다른 서비스를 이용해요', '기타'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setCancelReason(cancelReason === r ? '' : r)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      cancelReason === r
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-orange-200 text-orange-600'
                    }`}
                  >{r}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}
                className="flex-1 py-2 rounded-full text-xs border border-gray-200 text-gray-500"
              >취소</button>
              <button
                onClick={() => handleAction('cancel', () => callApi('/api/payments/cancel', { reason: cancelReason || undefined }))}
                disabled={actionLoading === 'cancel'}
                className="flex-1 py-2 rounded-full text-xs bg-orange-500 text-white font-medium disabled:opacity-50"
              >{actionLoading === 'cancel' ? '처리 중...' : '해지 확인'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Plan comparison link */}
      <div className="mt-8 text-center">
        <button
          onClick={() => router.push('/pricing')}
          className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
        >
          요금제 비교 보기 →
        </button>
      </div>

      {/* Contact */}
      <p className="text-[11px] text-gray-400 text-center mt-4">
        결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>
      </p>
    </div>
  );
}

// ─── Subcomponents ───

function InfoRow({ icon, label, value, valueColor = 'text-gray-700' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

function ActionButton({ label, onClick, primary, danger, muted, icon }: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  const base = 'w-full py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1';
  const style = primary ? `${base} bg-blue-600 text-white hover:bg-blue-700`
    : danger ? `${base} border border-red-200 text-red-500 hover:bg-red-50`
    : muted ? `${base} border border-gray-200 text-gray-500 hover:bg-gray-50`
    : `${base} border border-blue-200 text-blue-600 hover:bg-blue-50`;
  return <button onClick={onClick} className={style}>{label}{icon}</button>;
}

function ConfirmBox({ icon, title, description, confirmLabel, confirmColor, loading, onCancel, onConfirm }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-700">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-full text-xs border border-gray-200 text-gray-500">취소</button>
        <button onClick={onConfirm} disabled={loading}
          className={`flex-1 py-2 rounded-full text-xs text-white font-medium disabled:opacity-50 ${confirmColor}`}
        >{loading ? '처리 중...' : confirmLabel}</button>
      </div>
    </div>
  );
}
