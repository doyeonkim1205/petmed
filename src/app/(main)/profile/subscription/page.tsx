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
  reason?: string;
}

// ── Feature comparison ──

const planOrder: PlanType[] = ['free', 'plus'];

interface FeatureItem {
  label: string; key: string;
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
      { label: '논문 저장', key: 'saved', format: (p) => p === 'free' ? '-' : PLANS[p].maxSavedAnalyses === 0 ? '무제한' : `최대 ${PLANS[p].maxSavedAnalyses}개`, unavailable: (p) => p === 'free' },
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

const MONTHLY_ONETIME = 3900;  // 1회 결제 (기준가)
const MONTHLY_AUTO = 3500;     // 자동 결제 (10.3% 할인)
const YEARLY_PRICE = 40000;    // 연간 (14.5% 할인)

// ── Page ──

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [refundCheck, setRefundCheck] = useState<RefundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelWithRefund, setCancelWithRefund] = useState(false);
  const [cancelError, setCancelError] = useState('');
  // billingPeriod and billingMode removed — replaced by 3 direct buttons

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

  const handleCancel = async () => {
    setActionLoading('cancel');
    setActionMessage('');
    setCancelError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다.');
      const res = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined, withRefund: cancelWithRefund }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(data.message);
      setShowCancelConfirm(false);
      setCancelWithRefund(false);
      setCancelReason('');
      setCancelError('');
      await fetchData();
    } catch (err) {
      // Error stays in modal — user can retry or uncheck refund
      setCancelError(err instanceof Error ? err.message : '처리에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };


  const currentPlan = profile?.plan || 'free';
  const isPaid = currentPlan !== 'free';
  const isActive = subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const isRecurring = subscription?.billing_type === 'recurring';
  const isYearly = subscription?.product_id?.includes('yearly');
  const hasSub = isActive || isCanceled;

  const formatCard = () => {
    if (!subscription?.card_number) return '';
    const last4 = subscription.card_number.replace(/[^0-9]/g, '').slice(-4);
    const company = subscription.card_company ? `${subscription.card_company}카드` : '';
    return `${company} •••• ${last4}`.trim();
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10 border-b border-gray-100">
        <button onClick={() => router.push('/profile')} className="p-2 -ml-2 text-gray-500"><ArrowLeft size={20} /></button>
        <h1 className="text-sm font-semibold text-gray-700">구독/결제 관리</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-5">
        {/* ── 1. Plan Card ── */}
        <div className={`rounded-2xl border p-4 mb-5 ${isPaid ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {isPaid ? <Crown size={16} className="text-blue-500" /> : <Zap size={16} className="text-gray-400" />}
                <span className={`text-lg font-bold ${isPaid ? 'text-blue-700' : 'text-gray-700'}`}>{isPaid ? 'Plus' : 'Free'}</span>
              </div>
              <p className="text-xs text-gray-500">{isPaid ? '모든 기능을 제한 없이' : '기본 기능 무료 이용'}</p>
            </div>
            {hasSub && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-orange-400'}`} />
                {isActive ? '이용 중' : '해지됨'}
              </span>
            )}
          </div>
        </div>

        {/* ── Subscribe buttons (Free only — no subscription info) ── */}
        {!isPaid && !hasSub && (
          <div className="space-y-2.5 mb-5">
            <PlanBtn onClick={() => router.push('/payment?productId=plus_monthly_onetime')}
              title="월간 단건 결제" price={`월 ${MONTHLY_ONETIME.toLocaleString()}원`} />
            <PlanBtn onClick={() => router.push('/payment/billing-auth?productId=plus_monthly')} highlight
              title="월간 정기 결제" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
              sub="월간 단건 대비 10.3% 할인" />
            <PlanBtn onClick={() => router.push('/payment?productId=plus_yearly')}
              title="연간 결제" price={`연 ${YEARLY_PRICE.toLocaleString()}원`}
              sub={`월간 단건 기준 연 ${(MONTHLY_ONETIME * 12 - YEARLY_PRICE).toLocaleString()}원 절약`} />
          </div>
        )}

        {/* ── 2. Subscription Info ── */}
        {hasSub && subscription && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400">구독 정보</span>
            </div>
            <div className="divide-y divide-gray-50">
              <DetailRow icon={<RefreshCw size={14} className={isRecurring ? 'text-blue-500' : 'text-gray-400'} />}
                label="결제 방식" value={isRecurring ? '자동 갱신' : '1회 결제'} accent={isRecurring} />
              <DetailRow icon={<Calendar size={14} className="text-gray-400" />}
                label={isYearly ? '이용 기간 (연간)' : '이용 기간'} value={`${new Date(subscription.period_end).toLocaleDateString('ko-KR')}까지`} />
              {isRecurring && subscription.next_billing_at && (
                <DetailRow icon={<CreditCard size={14} className="text-blue-500" />}
                  label="다음 결제일" value={new Date(subscription.next_billing_at).toLocaleDateString('ko-KR')} accent />
              )}
              {isRecurring && subscription.card_number && (
                <DetailRow icon={<Shield size={14} className="text-gray-400" />}
                  label="결제 카드" value={formatCard()} />
              )}
            </div>
          </div>
        )}

        {/* ── Re-subscribe buttons (canceled — after subscription info) ── */}
        {isCanceled && (
          <div className="space-y-2.5 mb-5">
            <PlanBtn onClick={() => router.push('/payment?productId=plus_monthly_onetime')}
              title="월간 단건 결제" price={`월 ${MONTHLY_ONETIME.toLocaleString()}원`} />
            <PlanBtn onClick={() => router.push('/payment/billing-auth?productId=plus_monthly')} highlight
              title="월간 정기 결제" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
              sub="월간 단건 대비 10.3% 할인" />
            <PlanBtn onClick={() => router.push('/payment?productId=plus_yearly')}
              title="연간 결제" price={`연 ${YEARLY_PRICE.toLocaleString()}원`}
              sub={`월간 단건 기준 연 ${(MONTHLY_ONETIME * 12 - YEARLY_PRICE).toLocaleString()}원 절약`} />
          </div>
        )}

        {/* ── 3. Action Message ── */}
        {actionMessage && (
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 mb-4 leading-relaxed">{actionMessage}</div>
        )}

        {/* ── 4. Primary Actions ── */}
        {isActive && (
          <div className="space-y-2 mb-6">
            <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-2 text-center">
              플랜 변경 시 현재 이용 기간 종료 후 적용됩니다.
            </p>

            {/* 1회(월간) → 정기 결제 전환 */}
            {!isRecurring && !isYearly && (
              <PlanBtn onClick={() => router.push(`/payment/billing-auth?productId=plus_monthly&mode=enable`)} highlight
                title="월간 정기 결제로 전환" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
                sub="월간 단건 대비 10.3% 할인" />
            )}

            {/* 연간 아닌 경우 → 연간 전환 */}
            {!isYearly && (
              <PlanBtn onClick={() => router.push('/payment?productId=plus_yearly&upgrade=true')}
                title="연간 결제로 변경" price={`연 ${YEARLY_PRICE.toLocaleString()}원`}
                sub={`월간 단건 기준 연 ${(MONTHLY_ONETIME * 12 - YEARLY_PRICE).toLocaleString()}원 절약`} />
            )}

            {/* 자동 갱신 → 카드 변경 */}
            {isRecurring && (
              <ActionBtn onClick={() => router.push(`/payment/billing-auth?productId=${subscription?.product_id || 'plus_monthly'}`)}>
                결제 카드 변경
              </ActionBtn>
            )}
          </div>
        )}

        {/* ── 5. Feature Comparison ── */}
        <div className="border-t border-gray-100 pt-6 mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4 text-center">기능 비교</h2>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-gray-400 font-medium w-[35%]"></th>
                  {planOrder.map((p) => (
                    <th key={p} className={`text-center py-2.5 px-2 font-bold ${p === 'plus' ? 'text-blue-600' : 'text-gray-500'}`}>{PLANS[p].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureGroups.map((group) => (
                  <>
                    <tr key={`g-${group.title}`} className="bg-gray-50/80">
                      <td colSpan={3} className="py-1.5 px-3 text-[11px] font-bold text-gray-400 tracking-wider">{group.title}</td>
                    </tr>
                    {group.features.map((feat) => (
                      <tr key={feat.key} className="border-t border-gray-100 bg-white">
                        <td className="py-2.5 px-3 text-gray-600">{feat.label}</td>
                        {planOrder.map((p) => {
                          const isUnavailable = feat.unavailable?.(p);
                          const isBetter = p !== 'free' && !isUnavailable;
                          return (
                            <td key={p} className={`py-2.5 px-2 text-center ${isUnavailable ? 'text-gray-300' : isBetter ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                              {isUnavailable ? <X size={12} className="inline text-gray-300" /> : feat.format(p)}
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

        </div>

        {/* ── 6. Cancel (below feature comparison) ── */}
        {isActive && (
          <div className="mb-6">
            {!showCancelConfirm && (
              <ActionBtn onClick={() => setShowCancelConfirm(true)} variant="muted">
                구독 해지
              </ActionBtn>
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

                {refundCheck?.refundable && (
                  <div className="bg-white rounded-xl border border-green-200 p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={cancelWithRefund} onChange={(e) => setCancelWithRefund(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-green-600" />
                      <div>
                        <p className="text-xs font-semibold text-green-700">환불 받기 ({refundCheck.amount?.toLocaleString()}원)</p>
                        <p className="text-[10px] text-green-600/70 mt-0.5">
                          {refundCheck.reason && <span>{refundCheck.reason}. </span>}
                          카드사에 따라 반영에 3~10영업일 소요.
                        </p>
                        <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline">환불 정책 보기</a>
                      </div>
                    </label>
                  </div>
                )}
                {refundCheck && !refundCheck.refundable && refundCheck.reason !== '결제 내역이 없습니다.' && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500">
                      {refundCheck.reason || '환불 조건을 충족하지 않아 환불이 불가합니다.'}
                    </p>
                    <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline">환불 정책 보기</a>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-orange-600/70 mb-2">해지 사유 (선택)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['가격이 부담돼요', '사용 빈도가 낮아요', '필요한 기능이 없어요', '다른 서비스를 이용해요'].map((r) => (
                      <button key={r} onClick={() => setCancelReason(cancelReason === r ? '' : r)}
                        className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${cancelReason === r ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                {cancelError && (
                  <div className="p-2.5 bg-red-50 rounded-lg text-[11px] text-red-600">
                    {cancelError}
                    <p className="mt-1 text-[10px] text-red-400">다시 시도하거나 고객센터에 문의해주세요.</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setCancelWithRefund(false); setCancelError(''); }}
                    className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">취소</button>
                  <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                    className="flex-1 py-2.5 rounded-xl text-xs bg-orange-500 text-white font-medium disabled:opacity-50">
                    {actionLoading === 'cancel' ? '처리 중...' : cancelWithRefund ? '환불 후 해지' : '해지 확인'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center pb-4">
          <p className="text-[11px] text-gray-300">결제 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-400">dylabs.pawdex@gmail.com</a></p>
        </div>
      </div>
    </div>
  );
}

// ── Components ──

function DetailRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-2.5">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <span className={`text-xs font-semibold ${accent ? 'text-blue-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function ActionBtn({ children, onClick, variant = 'default' }: { children: React.ReactNode; onClick: () => void; variant?: 'default' | 'blue' | 'muted' }) {
  const styles = { default: 'border border-gray-200 text-gray-700 hover:bg-gray-50', blue: 'border border-blue-200 text-blue-600 hover:bg-blue-50', muted: 'border border-gray-200 text-gray-400 hover:bg-gray-50' };
  return <button onClick={onClick} className={`w-full py-3 rounded-2xl text-xs font-medium text-center transition-colors ${styles[variant]}`}>{children}</button>;
}

function PlanBtn({ onClick, title, price, sub, highlight }: {
  onClick: () => void; title: string; price: string; sub?: string; highlight?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        highlight ? 'border-blue-300 bg-blue-50/40 hover:bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-xs font-bold ${highlight ? 'text-blue-700' : 'text-gray-700'}`}>{title}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{price}</span>
      </div>
      {sub && (
        <p className={`text-[10px] ${highlight ? 'text-blue-500' : 'text-gray-400'}`}>{sub}</p>
      )}
    </button>
  );
}
