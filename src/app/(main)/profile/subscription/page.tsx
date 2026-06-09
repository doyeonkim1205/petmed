'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Crown, RefreshCw, Calendar, CreditCard, Shield,
  AlertTriangle, Loader2, Zap, Check, X,
} from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PLANS, type PlanType, isTrialActive, trialDaysLeft } from '@/lib/plans';

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
  billing_failed_count?: number;
  last_billing_failure_at?: string | null;
  last_billing_failure_reason?: string | null;
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
  label: string;
  sublabel?: string;
  key: string;
  format: (plan: PlanType) => string;
  unavailable?: (plan: PlanType) => boolean;
}

const featureGroups: { title: string; features: FeatureItem[] }[] = [
  {
    title: 'AI 케어',
    features: [
      // 순서: 논문 검색 → 증상 분석 → 증상 재분석 → 사진 분석.
      // 논문 검색·증상 분석: limitWindow 에 따라 단위 표기 (무료=회/월, Plus=회/일). 재분석은 항상 회/일.
      { label: '논문 검색', key: 'search', format: (p) => `${PLANS[p].searchPerDay}회/${PLANS[p].limitWindow === 'month' ? '월' : '일'}` },
      { label: '증상 분석', key: 'symptom', format: (p) => `${PLANS[p].symptomSearchPerDay}회/${PLANS[p].limitWindow === 'month' ? '월' : '일'}` },
      { label: '증상 재분석', key: 'refine', format: (p) => `${PLANS[p].symptomRefinePerDay}회/일` },
      {
        label: '사진 분석',
        key: 'photo',
        // Free 는 평생 1회 체험 (일일 X), Plus 는 일일 3회.
        format: (p) => p === 'free'
          ? (PLANS[p].photoAnalysisLifetimeFree > 0 ? `${PLANS[p].photoAnalysisLifetimeFree}회 체험` : '-')
          : `${PLANS[p].photoAnalysisPerDay}회/일`,
      },
    ],
  },
  {
    title: '총 한도',
    features: [
      { label: '건강 기록', key: 'records', format: (p) => PLANS[p].maxRecords === 0 ? '무제한' : `최대 ${PLANS[p].maxRecords}개` },
      // 보관함 라인은 비교표에서 제거 — 사용자에게는 "무제한"으로 보이는데 내부 500 cap 이라
      // 도달 시 모순 메시지. Free vs Plus 차이는 분석 화면 저장 버튼 비활성으로 충분히 노출.
      // "반려동물(2 vs 10)"·"첨부파일(1 vs 5)" 라인은 제거 — 쩨쩨한 차별로 Plus 가치가 싸 보임.
      //   한도는 plans.ts 에 유지하되 비교표에선 핵심 가치(맞춤 분석/무제한 기록/전체 통계)에 집중.
      // "저장 용량" 라인도 제거 — 앱 설정의 "저장 공간" 섹션으로 충분히 노출.
    ],
  },
  {
    title: '기능',
    features: [
      // 맞춤 분석 — Plus 핵심 차별점. 무료 ✗ / Plus ✓ (반려동물 정보 반영).
      { label: '맞춤 분석', sublabel: '(반려동물 정보 반영)', key: 'petContext', format: () => '✓', unavailable: (p) => !PLANS[p].petContextAnalysis },
      { label: '건강 통계', key: 'cost', format: (p) => p === 'free' ? `최근 ${PLANS[p].costStatsMonths}개월` : '전체' },
      { label: '동시 접속', key: 'devices', format: (p) => `${PLANS[p].maxDevices}대` },
      {
        label: '푸시 알림',
        sublabel: '(투약·예약·퇴원)',
        key: 'push',
        format: () => '✓',
        unavailable: (p) => p === 'free',
      },
    ],
  },
];

const MONTHLY_ONETIME = 3900;  // 1회 결제 (기준가)
const MONTHLY_AUTO = 3500;     // 자동 결제 (10.3% 할인)
const YEARLY_PRICE = 40000;    // 연간 (14.5% 할인)
// 연간 결제 표시용 — 월 환산 + 할인율. 가격 상수 변경 시 자동 반영.
const YEARLY_MONTHLY_EQUIV = Math.round(YEARLY_PRICE / 12);                                        // 3333
const YEARLY_DISCOUNT_PCT = Math.round((1 - YEARLY_PRICE / (MONTHLY_ONETIME * 12)) * 1000) / 10;   // 14.5

// ── Page ──

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [refundCheck, setRefundCheck] = useState<RefundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // 환불 여부는 refundCheck.refundable 결과로 자동 결정 — 사용자 선택 X.
  // (24h 이내 + 미사용 = 무조건 환불 + 즉시 free. 별도 토글 의미 없음)
  const [cancelError, setCancelError] = useState('');
  const [showComingSoon, setShowComingSoon] = useState(false);
  // 트라이얼 기간 중 정기 결제 버튼 누르면 뜨는 안내 모달.
  // "나중에 진행" 닫기 / "이어서 진행" 실제 결제창. 유저 실수 결제 방지 + 토스 심사 경로 확보.
  const [trialConfirmTarget, setTrialConfirmTarget] = useState<string | null>(null);
  // billingPeriod and billingMode removed — replaced by 3 direct buttons

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const token = session.access_token;
    // AuthContext 의 profile 캐시가 stale 일 수 있어 (관리자가 수동 변경한 경우)
    // 페이지 진입할 때마다 최신 profile 재조회 — subscription 상태와 불일치 방지.
    await refreshProfile();
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
    // Track page view
    import('@/lib/trackEvent').then(({ trackEvent }) => trackEvent('page.subscription'));
  }, [user, authLoading, router]);

  const handleRetryBilling = async () => {
    setActionLoading('retry');
    setActionMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다.');
      const res = await fetch('/api/payments/billing/retry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결제에 실패했어요.');
      setActionMessage('결제가 완료되었어요. 다음 결제일이 갱신되었습니다.');
      await fetchData();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'subscription', action: 'retry' },
        extra: { userId: user?.id },
      });
      setActionMessage(err instanceof Error ? err.message : '재결제에 실패했어요.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel');
    setActionMessage('');
    setCancelError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다.');
      const withRefund = refundCheck?.refundable === true;
      const res = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined, withRefund }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(data.message);
      setShowCancelConfirm(false);
      setCancelReason('');
      setCancelError('');
      await fetchData();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'subscription', action: 'cancel' },
        extra: { userId: user?.id, withRefund: refundCheck?.refundable === true, reason: cancelReason },
      });
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
  // 결제 실패 retry 중 — Grace Period 안내 + 즉시 재결제 노출 조건.
  // 자동 갱신 유저만 즉시 재결제 가능 (1회 결제는 next_billing_at 없음 → cron 안 돔).
  const billingFailedCount = subscription?.billing_failed_count || 0;
  const isInRetry = isActive && billingFailedCount > 0 && isRecurring;

  // Toss returns issuer codes instead of card company names
  const CARD_ISSUERS: Record<string, string> = {
    '3K': 'KB국민', '46': '광주', '71': '롯데', '51': '삼성',
    '38': '새마을금고', '41': '신한', '62': '신협', '36': '씨티',
    '33': '우리', 'W1': '우체국', '37': '수협', '35': '전북',
    '42': '제주', '15': '카카오뱅크', '3A': '케이뱅크', '24': '토스뱅크',
    '21': '하나', '61': '현대', '11': 'BC', '91': 'NH농협',
  };

  const formatCard = () => {
    if (!subscription?.card_number) return '';
    const last4 = subscription.card_number.replace(/[^0-9]/g, '').slice(-4);
    const raw = subscription.card_company || '';
    const company = CARD_ISSUERS[raw] || raw;
    return `${company}카드 •••• ${last4}`.trim();
  };

  if (authLoading || loading) {
    return <LoadingScreen inMain />;
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 bg-white z-10">
        <button onClick={() => router.push('/profile')} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">구독/결제 관리</h1>
      </header>

      <div className="px-4 pt-2">
        {/* ── Trial 안내 카드 (트라이얼 기간 중에만 표시) ── */}
        {isTrialActive() && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-5 mb-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-base font-bold text-gray-900 mb-1">3주 무료 체험 중이에요</h3>
            <p className="text-xs text-gray-600 mb-4">모든 Plus 기능을 자유롭게 이용하세요</p>
            <div className="bg-white/70 rounded-xl px-4 py-3">
              <p className="text-[11px] text-gray-500 mb-0.5">무료 체험 종료</p>
              <p className="text-sm font-bold text-gray-800">
                2026. 05. 13 · {trialDaysLeft()}일 남음
              </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              종료 후 유료 플랜 선택이 활성화됩니다
            </p>
          </div>
        )}

        {/* ── 1. Plan Card ── */}
        <div className={`rounded-2xl border p-4 mb-5 ${isPaid || isTrialActive() ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {isPaid || isTrialActive() ? <Crown size={16} className="text-blue-500" /> : <Zap size={16} className="text-gray-400" />}
                <span className={`text-lg font-bold ${isPaid || isTrialActive() ? 'text-blue-700' : 'text-gray-700'}`}>
                  {isPaid ? 'Plus' : isTrialActive() ? 'Plus (무료 체험)' : 'Free'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {isPaid ? '맞춤 관리, 더 꼼꼼하게' : isTrialActive() ? '3주 무료 체험 기간 적용 중' : '무료로 건강기록 시작'}
              </p>
            </div>
            {hasSub && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-orange-400'}`} />
                {isActive ? '현재 이용 중' : '해지 예약'}
              </span>
            )}
          </div>
        </div>

        {/* ── Subscribe buttons (Free only — no subscription info) ── */}
        {!isPaid && !hasSub && (
          <div className="mb-5">
            <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3 text-center">결제 옵션</h2>
            <div className="space-y-2.5">
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title="월간 단건 결제" price={`월 ${MONTHLY_ONETIME.toLocaleString()}원`}
                sub="한번만 결제하고 30일 동안 이용" />
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget('/payment/billing-auth?productId=plus_monthly') : router.push('/payment/billing-auth?productId=plus_monthly')}
                title="월간 정기 결제" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
                sub="월간 단건 대비 10.3% 할인" badge="추천" badgeColor="bg-blue-100 text-blue-600" />
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title="연간 결제" price={`월 ${YEARLY_MONTHLY_EQUIV.toLocaleString()}원`}
                priceSub={`연 ${YEARLY_PRICE.toLocaleString()}원 일시 결제`}
                sub={`월간 단건 대비 ${YEARLY_DISCOUNT_PCT}% 할인`}
                badge="장기 케어" badgeColor="bg-green-100 text-green-600" />
            </div>
            </div>
          </div>
        )}

        {/* ── Billing retry banner ── */}
        {isInRetry && subscription && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900 mb-1">자동 결제가 보류 중이에요</p>
                <p className="text-xs text-amber-800 leading-relaxed mb-2">
                  카드 거절 등의 사유로 결제가 완료되지 않았어요. 다음 자동 재시도 전까지 Plus 기능은 계속 사용하실 수 있고,
                  {subscription.next_billing_at && (
                    <> <span className="font-medium">{new Date(subscription.next_billing_at).toLocaleDateString('ko-KR')}</span>에 자동 재시도됩니다.</>
                  )}
                </p>
                {subscription.last_billing_failure_reason && (
                  <p className="text-[11px] text-amber-700 bg-amber-100 rounded px-2 py-1 mb-2 inline-block">
                    실패 사유: {subscription.last_billing_failure_reason}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleRetryBilling}
                    disabled={actionLoading === 'retry'}
                    className="flex-1 py-2 rounded-full bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {actionLoading === 'retry' ? (
                      <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 결제 중...</span>
                    ) : '지금 다시 결제'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/payment/billing-auth?productId=plus_monthly')}
                    className="flex-1 py-2 rounded-full border border-amber-400 bg-white text-amber-700 text-xs font-medium"
                  >
                    새 카드로 등록
                  </button>
                </div>
              </div>
            </div>
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
                label="결제 방식" value={isRecurring ? '월간 구독' : isYearly ? '연간 이용권' : '30일 이용권'} accent={isRecurring} />
              {isRecurring ? (
                subscription.next_billing_at && (
                  <DetailRow icon={<Calendar size={14} className="text-blue-500" />}
                    label="다음 결제일" value={new Date(subscription.next_billing_at).toLocaleDateString('ko-KR')} accent />
                )
              ) : (
                <DetailRow icon={<Calendar size={14} className="text-gray-400" />}
                  label="만료일" value={new Date(subscription.period_end).toLocaleDateString('ko-KR')} />
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
          <div className="mb-5">
            <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3 text-center">결제 옵션</h2>
            <div className="space-y-2.5">
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title="월간 단건 결제" price={`월 ${MONTHLY_ONETIME.toLocaleString()}원`}
                sub="한번만 결제하고 30일 동안 이용" />
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget('/payment/billing-auth?productId=plus_monthly') : router.push('/payment/billing-auth?productId=plus_monthly')}
                title="월간 정기 결제" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
                sub="월간 단건 대비 10.3% 할인" badge="추천" badgeColor="bg-blue-100 text-blue-600" />
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title="연간 결제" price={`월 ${YEARLY_MONTHLY_EQUIV.toLocaleString()}원`}
                priceSub={`연 ${YEARLY_PRICE.toLocaleString()}원 일시 결제`}
                sub={`월간 단건 대비 ${YEARLY_DISCOUNT_PCT}% 할인`}
                badge="장기 케어" badgeColor="bg-green-100 text-green-600" />
            </div>
            </div>
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
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget(`/payment/billing-auth?productId=plus_monthly&mode=enable`) : router.push(`/payment/billing-auth?productId=plus_monthly&mode=enable`)}
                title="월간 구독으로 전환" price={`월 ${MONTHLY_AUTO.toLocaleString()}원`}
                sub="월간 단건 대비 10.3% 할인" badge="추천" badgeColor="bg-blue-100 text-blue-600" />
            )}

            {/* 연간 아닌 경우 → 연간 전환 */}
            {!isYearly && (
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title="연간 이용권으로 변경" price={`월 ${YEARLY_MONTHLY_EQUIV.toLocaleString()}원`}
                priceSub={`연 ${YEARLY_PRICE.toLocaleString()}원 일시 결제`}
                sub={`월간 단건 대비 ${YEARLY_DISCOUNT_PCT}% 할인`}
                badge="장기 케어" badgeColor="bg-green-100 text-green-600" />
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
          <h2 className="text-sm font-bold text-gray-800 mb-4 text-center">주요 기능 비교</h2>

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
                        <td className="py-2.5 px-3 text-gray-600">
                          <div>{feat.label}</div>
                          {feat.sublabel && (
                            <div className="text-[10px] text-gray-400 mt-0.5">{feat.sublabel}</div>
                          )}
                        </td>
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
              <div className="rounded-2xl border border-orange-500 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-orange-700">구독을 해지하시겠습니까?</p>
                </div>
                <p className="text-[11px] text-orange-500/80 leading-relaxed">
                  {refundCheck?.refundable
                    ? '지금 해지하시면 즉시 Free 플랜으로 전환되며, 결제 금액이 전액 환불됩니다.'
                    : <>
                        {new Date(subscription!.period_end).toLocaleDateString('ko-KR')}까지 이용 가능하며, 이후 무료 플랜으로 전환됩니다.
                        {isRecurring && ' 자동 결제도 중지됩니다.'}
                      </>
                  }
                </p>

                {refundCheck?.refundable && (
                  <div className="bg-white rounded-xl border border-green-200 p-3">
                    <p className="text-xs text-green-700">
                      예상 환불 금액 : <span className="font-bold">{refundCheck.amount?.toLocaleString()}원</span>
                    </p>
                    <p className="text-[10px] text-green-600/70 mt-0.5 leading-relaxed">
                      {refundCheck.reason && <span>{refundCheck.reason}. </span>}
                      카드사에 따라 반영에 3~10영업일 소요됩니다.
                    </p>
                    <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline mt-1 inline-block">환불 정책 보기</a>
                  </div>
                )}
                {refundCheck && !refundCheck.refundable && refundCheck.reason !== '결제 내역이 없습니다.' && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {refundCheck.reason || '환불 조건을 충족하지 않습니다.'}{refundCheck.reason && refundCheck.reason.endsWith('.') ? '' : '.'} 환불이 불가합니다.{' '}
                      남은 이용 기간 동안 Plus 혜택은 그대로 유지되며{isRecurring ? ', 다음 결제일에 자동 갱신되지 않습니다.' : '.'}
                    </p>
                    <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline mt-1 inline-block">환불 정책 보기</a>
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
                  <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setCancelError(''); }}
                    className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">취소</button>
                  <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                    className="flex-1 py-2.5 rounded-xl text-xs bg-orange-500 text-white font-medium disabled:opacity-50">
                    {actionLoading === 'cancel'
                      ? '처리 중...'
                      : refundCheck?.refundable
                        ? '환불 및 해지'
                        : isRecurring
                          ? '자동 결제 해지'
                          : '구독 해지'
                    }
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

      {/* ── Coming Soon Modal (단건/연간 결제 심사 중) ── */}
      {showComingSoon && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowComingSoon(false)}>
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Calendar size={20} className="text-blue-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">
                서비스 준비 중입니다
                {/* 토스 심사 전용 비밀 아이콘 — 클릭 시 단기 결제 페이지로 이동.
                    일반 사용자는 줄 끝 마침표로 인식. 심사 통과 후 제거. */}
                <button
                  type="button"
                  onClick={() => { setShowComingSoon(false); router.push('/payment?productId=plus_monthly_onetime'); }}
                  className="text-gray-800 ml-0 align-baseline"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  .
                </button>
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                단건·연간 결제는 현재 준비 중이에요.<br />
                정기 결제로 먼저 이용해보세요.
              </p>
              <button onClick={() => setShowComingSoon(false)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trial Confirm Modal (무료 체험 중 정기 결제 시도할 때) ── */}
      {/* 실수 결제 방지 + 토스 심사 경로 확보. "이어서 진행" 누르면 실제 billing-auth 이동. */}
      {trialConfirmTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setTrialConfirmTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">🎁</div>
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">
                지금은 Plus 기능을 무료로 이용하실 수 있어요
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                2026. 05. 13 까지 모든 기능이 무료에요.<br />
                체험 기간에 결제하시면 Plus 혜택이<br />
                이어서 적용됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrialConfirmTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50"
                >
                  나중에 진행
                </button>
                <button
                  onClick={() => {
                    const target = trialConfirmTarget;
                    setTrialConfirmTarget(null);
                    if (target) router.push(target);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  이어서 진행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

function PlanBtn({ onClick, title, price, priceSub, sub, badge, badgeColor }: {
  onClick: () => void; title: string; price: string; priceSub?: string; sub?: string;
  badge?: string; badgeColor?: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
      {/* 좌우 2-column: 왼쪽 = title + sub / 오른쪽 = price + priceSub */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">{title}</span>
            {badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${badgeColor || 'bg-blue-100 text-blue-600'}`}>
                {badge}
              </span>
            )}
          </div>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">{price}</span>
          {priceSub && <p className="text-[9px] text-gray-400 mt-0.5">{priceSub}</p>}
        </div>
      </div>
    </button>
  );
}
