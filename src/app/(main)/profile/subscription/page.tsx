'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Crown, RefreshCw, Calendar, CreditCard, Shield,
  AlertTriangle, Loader2, Zap, Check, X,
} from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { platformPayments, isNativeApp } from '@/lib/platform';
import { PLANS, type PlanType, isTrialActive, trialDaysLeft } from '@/lib/plans';

// ── Types ──

interface SubscriptionInfo {
  plan: string;
  status: string;
  billing_type?: 'recurring' | 'one_time';
  store?: string; // 'toss' | 'play' | 'apple'
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

type TFn = ReturnType<typeof useTranslations>;

// 라벨/값 모두 messages 로 — t 를 받아 그룹 배열을 조립.
function buildFeatureGroups(t: TFn): { title: string; features: FeatureItem[] }[] {
  // 한도 단위 — limitWindow=month 면 회/월, 아니면 회/일.
  const perWindow = (p: PlanType, n: number) =>
    PLANS[p].limitWindow === 'month' ? t('subscription.val.perMonth', { n }) : t('subscription.val.perDay', { n });
  return [
    {
      title: t('home.section.aiCare'),
      features: [
        { label: t('subscription.feature.search'), key: 'search', format: (p) => perWindow(p, PLANS[p].searchPerDay) },
        { label: t('subscription.feature.symptom'), key: 'symptom', format: (p) => perWindow(p, PLANS[p].symptomSearchPerDay) },
        { label: t('subscription.feature.refine'), key: 'refine', format: (p) => t('subscription.val.perDay', { n: PLANS[p].symptomRefinePerDay }) },
        {
          label: t('subscription.feature.photo'),
          key: 'photo',
          // Free 는 평생 1회 체험 (일일 X), Plus 는 일일 3회.
          format: (p) => p === 'free'
            ? (PLANS[p].photoAnalysisLifetimeFree > 0 ? t('subscription.val.photoTrial', { n: PLANS[p].photoAnalysisLifetimeFree }) : '-')
            : t('subscription.val.perDay', { n: PLANS[p].photoAnalysisPerDay }),
        },
        { label: t('subscription.feature.petContext'), sublabel: t('subscription.feature.petContextSub'), key: 'petContext', format: () => '✓', unavailable: (p) => !PLANS[p].petContextAnalysis },
      ],
    },
    {
      title: t('subscription.groupRecordManage'),
      features: [
        { label: t('subscription.feature.pets'), key: 'pets', format: (p) => PLANS[p].maxPets === 0 ? t('subscription.val.unlimited') : t('subscription.val.petsCount', { n: PLANS[p].maxPets }) },
        { label: t('subscription.feature.records'), key: 'records', format: (p) => PLANS[p].maxRecords === 0 ? t('subscription.val.unlimited') : t('subscription.val.maxCount', { n: PLANS[p].maxRecords }) },
        { label: t('subscription.feature.attachments'), sublabel: t('subscription.feature.attachmentsSub'), key: 'attachments', format: (p) => t('subscription.val.count', { n: PLANS[p].attachmentsPerRecord }) },
        { label: t('subscription.feature.healthStats'), key: 'healthStats', format: (p) => p === 'free' ? t('subscription.val.recentMonths', { n: PLANS[p].costStatsMonths }) : t('subscription.val.allTime') },
        { label: t('subscription.feature.expenseStats'), key: 'expenseStats', format: (p) => p === 'free' ? t('subscription.val.recentMonths', { n: PLANS[p].costStatsMonths }) : t('subscription.val.allTime') },
        { label: t('subscription.feature.push'), sublabel: t('subscription.feature.pushSub'), key: 'push', format: () => '✓', unavailable: (p) => p === 'free' },
        { label: t('subscription.feature.savedAnalyses'), sublabel: t('subscription.feature.savedAnalysesSub'), key: 'savedAnalyses', format: () => '✓', unavailable: (p) => PLANS[p].maxSavedAnalyses === 0 },
        { label: t('subscription.feature.devices'), sublabel: t('subscription.feature.devicesSub'), key: 'devices', format: (p) => t('subscription.val.devicesCount', { n: PLANS[p].maxDevices }) },
      ],
    },
  ];
}

const MONTHLY_ONETIME = 3900;  // 1회 결제 (기준가)
const MONTHLY_AUTO = 3500;     // 자동 결제 (10.3% 할인)
const YEARLY_PRICE = 40000;    // 연간 (14.5% 할인)
// 연간 결제 표시용 — 월 환산 + 할인율. 가격 상수 변경 시 자동 반영.
const YEARLY_MONTHLY_EQUIV = Math.round(YEARLY_PRICE / 12);                                        // 3333
const YEARLY_DISCOUNT_PCT = Math.round((1 - YEARLY_PRICE / (MONTHLY_ONETIME * 12)) * 1000) / 10;   // 14.5

// ── Page ──

export default function SubscriptionPage() {
  const t = useTranslations();
  const uiLocale = useLocale();
  const dateLocale = uiLocale === 'en' ? 'en-US' : 'ko-KR';
  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(dateLocale);
  const featureGroups = buildFeatureGroups(t);
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
  // ── 결제 플랫폼 3-상태 분기 ──
  // 토스 UI 는 반드시 웹(!isApp)에서만. 앱에선 토스 라우트(/payment*)를 절대 노출하지 않는다(Play 정책).
  //   - 웹(!isApp)              → 토스 결제 UI
  //   - 앱 + RC ready(rcReady)  → RevenueCat 구매 UI
  //   - 앱 + RC 없음            → "구독 준비 중"(비활성). 토스 fallback 금지.
  const isApp = isNativeApp();
  const rcReady = platformPayments.isRevenueCatReady();
  const appRcBilling = isApp && rcReady;  // 앱에서 RC 구매 버튼 노출
  const [purchasing, setPurchasing] = useState(false);
  const [nativePrice, setNativePrice] = useState<string | null>(null);

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

  // 앱+RC: 오퍼링에서 월간 상품의 로컬라이즈 가격(Play 실제가)을 가져와 표시.
  useEffect(() => {
    if (!user || !appRcBilling) return;
    platformPayments.getPriceString(user.id, 'plus_monthly').then(setNativePrice).catch(() => {});
  }, [user, appRcBilling]);

  const handleRetryBilling = async () => {
    setActionLoading('retry');
    setActionMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('subscription.error.sessionExpired'));
      const res = await fetch('/api/payments/billing/retry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('subscription.error.paymentFailed'));
      setActionMessage(t('subscription.error.retrySuccess'));
      await fetchData();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'subscription', action: 'retry' },
        extra: { userId: user?.id },
      });
      setActionMessage(err instanceof Error ? err.message : t('subscription.error.retryFailed'));
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
      if (!session) throw new Error(t('subscription.error.sessionExpired'));
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
      setCancelError(err instanceof Error ? err.message : t('subscription.error.processFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // ── 네이티브 결제(RevenueCat) 핸들러 ──
  // 권한(profiles.plan)의 진실원은 RC 웹훅. 구매 성공 후 약간의 지연 대비 재조회.
  const handleNativePurchase = async (productId: string) => {
    if (!user || purchasing) return;
    setPurchasing(true);
    setActionMessage('');
    try {
      const res = await platformPayments.purchase(user.id, productId);
      if (res.canceled) return; // 사용자가 결제창에서 취소 — 조용히 무시
      if (res.ok && res.active) {
        setActionMessage(t('subscription.purchaseSuccess'));
        await refreshProfile();
        await fetchData();
      } else {
        setActionMessage(res.error || t('subscription.purchaseError'));
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'subscription', action: 'rc-purchase' }, extra: { userId: user?.id, productId } });
      setActionMessage(t('subscription.purchaseError'));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!user || purchasing) return;
    setPurchasing(true);
    setActionMessage('');
    try {
      const res = await platformPayments.restore(user.id);
      if (res.active) {
        setActionMessage(t('subscription.purchaseSuccess'));
        await refreshProfile();
        await fetchData();
      } else {
        setActionMessage(t('subscription.restoreNone'));
      }
    } finally {
      setPurchasing(false);
    }
  };

  // Google Play 구독 화면 딥링크 (변경·해지·환불은 여기서). 시스템 브라우저로 열림(Capacitor).
  const goManageInPlay = () => window.open(platformPayments.manageSubscriptionsUrl(), '_blank');

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
    return t('subscription.cardFormat', { company, last4 }).trim();
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
        <h1 className="text-sm font-semibold text-gray-700">{t('subscription.title')}</h1>
      </header>

      <div className="px-4 pt-2">
        {/* ── Trial 안내 카드 (트라이얼 기간 중에만 표시) ── */}
        {isTrialActive() && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-5 mb-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-base font-bold text-gray-900 mb-1">{t('subscription.trialTitle')}</h3>
            <p className="text-xs text-gray-600 mb-4">{t('subscription.trialDesc')}</p>
            <div className="bg-white/70 rounded-xl px-4 py-3">
              <p className="text-[11px] text-gray-500 mb-0.5">{t('subscription.trialEndLabel')}</p>
              <p className="text-sm font-bold text-gray-800">
                {t('subscription.trialEndValue', { date: '2026. 05. 13', days: trialDaysLeft() })}
              </p>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              {t('subscription.trialAfterNote')}
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
                  {isPaid ? 'Plus' : isTrialActive() ? t('subscription.planPlusTrial') : 'Free'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {isPaid ? t('subscription.planDescPaid') : isTrialActive() ? t('subscription.planDescTrial') : t('subscription.planDescFree')}
              </p>
            </div>
            {hasSub && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-orange-400'}`} />
                {isActive ? t('subscription.statusActive') : t('subscription.statusCanceled')}
              </span>
            )}
          </div>
        </div>

        {/* ── Subscribe buttons (Free only — no subscription info) ── */}
        {!isPaid && !hasSub && (
          <div className="mb-5">
            <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3 text-center">{t('subscription.paymentOptions')}</h2>
            {!isApp ? (
            /* 웹: 토스 결제 (단건/정기/연간) */
            <div className="space-y-2.5">
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title={t('subscription.monthlyOnetimeTitle')} price={t('subscription.priceMonthly', { price: MONTHLY_ONETIME.toLocaleString() })}
                sub={t('subscription.monthlyOnetimeSub')} />
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget('/payment/billing-auth?productId=plus_monthly') : router.push('/payment/billing-auth?productId=plus_monthly')}
                title={t('subscription.monthlyAutoTitle')} price={t('subscription.priceMonthly', { price: MONTHLY_AUTO.toLocaleString() })}
                sub={t('subscription.monthlyAutoSub')} badge={t('subscription.badgeRecommended')} badgeColor="bg-blue-100 text-blue-600" />
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title={t('subscription.yearlyTitle')} price={t('subscription.priceMonthly', { price: YEARLY_MONTHLY_EQUIV.toLocaleString() })}
                priceSub={t('subscription.yearlyPriceSub', { price: YEARLY_PRICE.toLocaleString() })}
                sub={t('subscription.yearlySub', { pct: YEARLY_DISCOUNT_PCT })}
                badge={t('subscription.badgeLongCare')} badgeColor="bg-green-100 text-green-600" />
            </div>
            ) : appRcBilling ? (
              /* 앱(Play Billing): 월간 RC 구독 단일 버튼 + 복원. 토스 노출 X. */
              <div className="space-y-2.5">
                <PlanBtn onClick={() => handleNativePurchase('plus_monthly')}
                  title={t('subscription.subscribeMonthlyTitle')}
                  price={nativePrice || t('subscription.priceMonthly', { price: MONTHLY_AUTO.toLocaleString() })}
                  sub={t('subscription.subscribeMonthlySub')}
                  badge={t('subscription.badgeRecommended')} badgeColor="bg-blue-100 text-blue-600" />
                <button onClick={handleRestore} disabled={purchasing}
                  className="w-full text-center text-[11px] text-gray-400 underline py-1 disabled:opacity-50">
                  {t('subscription.restorePurchase')}
                </button>
              </div>
            ) : (
              /* 앱 + RC 미설정: 토스 fallback 금지 — 구독 준비 중(비활성). */
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
                <p className="text-sm font-semibold text-gray-500 mb-1">{t('subscription.preparingTitle')}</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">{t('subscription.preparingDesc')}</p>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ── Billing retry banner (토스 전용·웹만 — Play 는 Google 이 재시도 처리) ── */}
        {isInRetry && !isApp && subscription && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900 mb-1">{t('subscription.retryHoldTitle')}</p>
                <p className="text-xs text-amber-800 leading-relaxed mb-2">
                  {t('subscription.retryHoldDesc')}
                  {subscription.next_billing_at && (
                    t.rich('subscription.retryNextDate', {
                      date: fmtDate(subscription.next_billing_at),
                      b: (c) => <span className="font-medium">{c}</span>,
                    })
                  )}
                </p>
                {subscription.last_billing_failure_reason && (
                  <p className="text-[11px] text-amber-700 bg-amber-100 rounded px-2 py-1 mb-2 inline-block">
                    {t('subscription.failureReason', { reason: subscription.last_billing_failure_reason })}
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
                      <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {t('subscription.paying')}</span>
                    ) : t('subscription.payNow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/payment/billing-auth?productId=plus_monthly')}
                    className="flex-1 py-2 rounded-full border border-amber-400 bg-white text-amber-700 text-xs font-medium"
                  >
                    {t('subscription.newCard')}
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
              <span className="text-xs font-semibold text-gray-400">{t('subscription.subInfo')}</span>
            </div>
            <div className="divide-y divide-gray-50">
              <DetailRow icon={<RefreshCw size={14} className={isRecurring ? 'text-blue-500' : 'text-gray-400'} />}
                label={t('subscription.billingMethod')} value={isRecurring ? t('subscription.billingMonthly') : isYearly ? t('subscription.billingYearly') : t('subscription.billing30day')} accent={isRecurring} />
              {isRecurring ? (
                subscription.next_billing_at && (
                  <DetailRow icon={<Calendar size={14} className="text-blue-500" />}
                    label={t('subscription.nextBilling')} value={fmtDate(subscription.next_billing_at)} accent />
                )
              ) : (
                <DetailRow icon={<Calendar size={14} className="text-gray-400" />}
                  label={t('subscription.expiry')} value={fmtDate(subscription.period_end)} />
              )}
              {isRecurring && subscription.card_number && (
                <DetailRow icon={<Shield size={14} className="text-gray-400" />}
                  label={t('subscription.paymentCard')} value={formatCard()} />
              )}
            </div>
          </div>
        )}

        {/* ── Re-subscribe buttons (canceled — after subscription info) ── */}
        {isCanceled && (
          <div className="mb-5">
            <div className="border-t border-gray-100 pt-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3 text-center">{t('subscription.paymentOptions')}</h2>
            {!isApp ? (
            /* 웹: 토스 결제 (단건/정기/연간) */
            <div className="space-y-2.5">
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title={t('subscription.monthlyOnetimeTitle')} price={t('subscription.priceMonthly', { price: MONTHLY_ONETIME.toLocaleString() })}
                sub={t('subscription.monthlyOnetimeSub')} />
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget('/payment/billing-auth?productId=plus_monthly') : router.push('/payment/billing-auth?productId=plus_monthly')}
                title={t('subscription.monthlyAutoTitle')} price={t('subscription.priceMonthly', { price: MONTHLY_AUTO.toLocaleString() })}
                sub={t('subscription.monthlyAutoSub')} badge={t('subscription.badgeRecommended')} badgeColor="bg-blue-100 text-blue-600" />
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title={t('subscription.yearlyTitle')} price={t('subscription.priceMonthly', { price: YEARLY_MONTHLY_EQUIV.toLocaleString() })}
                priceSub={t('subscription.yearlyPriceSub', { price: YEARLY_PRICE.toLocaleString() })}
                sub={t('subscription.yearlySub', { pct: YEARLY_DISCOUNT_PCT })}
                badge={t('subscription.badgeLongCare')} badgeColor="bg-green-100 text-green-600" />
            </div>
            ) : appRcBilling ? (
              /* 앱(Play Billing): 월간 RC 구독 단일 버튼 + 복원. 토스 노출 X. */
              <div className="space-y-2.5">
                <PlanBtn onClick={() => handleNativePurchase('plus_monthly')}
                  title={t('subscription.subscribeMonthlyTitle')}
                  price={nativePrice || t('subscription.priceMonthly', { price: MONTHLY_AUTO.toLocaleString() })}
                  sub={t('subscription.subscribeMonthlySub')}
                  badge={t('subscription.badgeRecommended')} badgeColor="bg-blue-100 text-blue-600" />
                <button onClick={handleRestore} disabled={purchasing}
                  className="w-full text-center text-[11px] text-gray-400 underline py-1 disabled:opacity-50">
                  {t('subscription.restorePurchase')}
                </button>
              </div>
            ) : (
              /* 앱 + RC 미설정: 토스 fallback 금지 — 구독 준비 중(비활성). */
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
                <p className="text-sm font-semibold text-gray-500 mb-1">{t('subscription.preparingTitle')}</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">{t('subscription.preparingDesc')}</p>
              </div>
            )}
            </div>
          </div>
        )}

        {/* ── 3. Action Message ── */}
        {actionMessage && (
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 mb-4 leading-relaxed">{actionMessage}</div>
        )}

        {/* ── 4. Primary Actions (토스 전용·웹만 — 정기전환·연간전환·카드변경) ── */}
        {isActive && !isApp && (
          <div className="space-y-2 mb-6">
            <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-2 text-center">
              {t('subscription.planChangeNote')}
            </p>

            {/* 1회(월간) → 정기 결제 전환 */}
            {!isRecurring && !isYearly && (
              <PlanBtn onClick={() => isTrialActive() ? setTrialConfirmTarget(`/payment/billing-auth?productId=plus_monthly&mode=enable`) : router.push(`/payment/billing-auth?productId=plus_monthly&mode=enable`)}
                title={t('subscription.convertMonthlyTitle')} price={t('subscription.priceMonthly', { price: MONTHLY_AUTO.toLocaleString() })}
                sub={t('subscription.monthlyAutoSub')} badge={t('subscription.badgeRecommended')} badgeColor="bg-blue-100 text-blue-600" />
            )}

            {/* 연간 아닌 경우 → 연간 전환 */}
            {!isYearly && (
              <PlanBtn onClick={() => setShowComingSoon(true)}
                title={t('subscription.convertYearlyTitle')} price={t('subscription.priceMonthly', { price: YEARLY_MONTHLY_EQUIV.toLocaleString() })}
                priceSub={t('subscription.yearlyPriceSub', { price: YEARLY_PRICE.toLocaleString() })}
                sub={t('subscription.yearlySub', { pct: YEARLY_DISCOUNT_PCT })}
                badge={t('subscription.badgeLongCare')} badgeColor="bg-green-100 text-green-600" />
            )}

            {/* 자동 갱신 → 카드 변경 */}
            {isRecurring && (
              <ActionBtn onClick={() => router.push(`/payment/billing-auth?productId=${subscription?.product_id || 'plus_monthly'}`)}>
                {t('subscription.changeCard')}
              </ActionBtn>
            )}
          </div>
        )}

        {/* ── 4-native. 앱에서 활성 구독 관리 (store 별 분기) ── */}
        {isActive && isApp && (
          <div className="space-y-2 mb-6">
            {subscription?.store === 'play' ? (
              <>
                <ActionBtn onClick={goManageInPlay}>{t('subscription.manageInPlay')}</ActionBtn>
                <p className="text-[10px] text-gray-400 text-center px-2 leading-relaxed">{t('subscription.manageInPlayDesc')}</p>
              </>
            ) : (
              /* 웹(토스)에서 결제한 구독을 앱에서 열람 — 앱에선 관리 불가, 웹 안내 */
              <p className="text-[11px] text-gray-400 text-center px-2 leading-relaxed bg-gray-50 rounded-xl py-3">
                {t('subscription.manageOnWeb')}
              </p>
            )}
          </div>
        )}

        {/* ── 5. Feature Comparison ── */}
        <div className="border-t border-gray-100 pt-6 mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-4 text-center">{t('subscription.compareTitle')}</h2>

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

        {/* ── 6. Cancel (토스 전용·웹만 — 앱은 위 store별 관리 블록으로 해지) ── */}
        {isActive && !isApp && (
          <div className="mb-6">
            {!showCancelConfirm && (
              <ActionBtn onClick={() => setShowCancelConfirm(true)} variant="muted">
                {t('subscription.cancel')}
              </ActionBtn>
            )}

            {showCancelConfirm && (
              <div className="rounded-2xl border border-orange-500 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-orange-700">{t('subscription.cancelConfirm')}</p>
                </div>
                <p className="text-[11px] text-orange-500/80 leading-relaxed">
                  {refundCheck?.refundable
                    ? t('subscription.cancelRefundable')
                    : <>
                        {t('subscription.cancelNonRefundable', { date: fmtDate(subscription!.period_end) })}
                        {isRecurring && t('subscription.cancelAutoStop')}
                      </>
                  }
                </p>

                {refundCheck?.refundable && (
                  <div className="bg-white rounded-xl border border-green-200 p-3">
                    <p className="text-xs text-green-700">
                      {t('subscription.refundAmount')}<span className="font-bold">{t('subscription.amountWon', { amount: refundCheck.amount?.toLocaleString() ?? '' })}</span>
                    </p>
                    <p className="text-[10px] text-green-600/70 mt-0.5 leading-relaxed">
                      {refundCheck.reason && <span>{refundCheck.reason}. </span>}
                      {t('subscription.refundDelay')}
                    </p>
                    <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline mt-1 inline-block">{t('subscription.refundPolicy')}</a>
                  </div>
                )}
                {refundCheck && !refundCheck.refundable && refundCheck.reason !== '결제 내역이 없습니다.' && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {refundCheck.reason || t('subscription.refundReasonFallback')}{refundCheck.reason && refundCheck.reason.endsWith('.') ? '' : '.'}
                      {t('subscription.refundNotAvailable', { recurring: isRecurring ? t('subscription.refundRecurringTail') : t('subscription.refundOnetimeTail') })}
                    </p>
                    <a href="/refund" target="_blank" className="text-[10px] text-blue-500 underline mt-1 inline-block">{t('subscription.refundPolicy')}</a>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-orange-600/70 mb-2">{t('subscription.cancelReasonLabel')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[t('subscription.cancelReason1'), t('subscription.cancelReason2'), t('subscription.cancelReason3'), t('subscription.cancelReason4')].map((r) => (
                      <button key={r} onClick={() => setCancelReason(cancelReason === r ? '' : r)}
                        className={`px-2.5 py-1 rounded-full text-[10px] transition-colors ${cancelReason === r ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                {cancelError && (
                  <div className="p-2.5 bg-red-50 rounded-lg text-[11px] text-red-600">
                    {cancelError}
                    <p className="mt-1 text-[10px] text-red-400">{t('subscription.cancelRetryHint')}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setCancelError(''); }}
                    className="flex-1 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-500">{t('common.cancel')}</button>
                  <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                    className="flex-1 py-2.5 rounded-xl text-xs bg-orange-500 text-white font-medium disabled:opacity-50">
                    {actionLoading === 'cancel'
                      ? t('subscription.processing')
                      : refundCheck?.refundable
                        ? t('subscription.refundAndCancel')
                        : isRecurring
                          ? t('subscription.stopAutoBilling')
                          : t('subscription.cancel')
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center pb-4">
          <p className="text-[11px] text-gray-300">{t('subscription.contactLabel')}<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-400">dylabs.pawdex@gmail.com</a></p>
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
                {t('subscription.comingSoonTitle')}
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
                {t.rich('subscription.comingSoonBody', { br: () => <br /> })}
              </p>
              <button onClick={() => setShowComingSoon(false)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium">
                {t('common.confirm')}
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
                {t('subscription.trialConfirmTitle')}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                {t.rich('subscription.trialConfirmBody', { date: '2026. 05. 13', br: () => <br /> })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrialConfirmTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50"
                >
                  {t('subscription.later')}
                </button>
                <button
                  onClick={() => {
                    const target = trialConfirmTarget;
                    setTrialConfirmTarget(null);
                    if (target) router.push(target);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  {t('subscription.continue')}
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
