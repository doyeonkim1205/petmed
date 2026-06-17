'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { supabase } from '@/lib/supabase';

interface Props {
  authKey: string;
  customerKey: string;
  productId: string;
  mode: string; // 'register' | 'enable'
}

interface SuccessData {
  mode: 'register' | 'enable';
  productName: string;      // DB product.name e.g. "PawDex Plus 월간 자동 결제"
  period: 'month' | 'year';
  nextBillingAt: string;    // ISO date
  amount: number | null;
}

/**
 * 결제/자동갱신 카드 등록 완료 후 랜딩 페이지.
 *
 * UX 구조:
 *   [PawDex 로고]
 *   🎉 {mode 별 타이틀}
 *   ┌─ 카드 (블루 gradient) ─┐
 *   │ {상품명 + 완료 문구}    │
 *   │ 다음 결제일 · 금액      │
 *   └────────────────────────┘
 *   잠시 후 이동합니다...  (2.5s)
 */
export default function BillingAuthSuccessClient({ authKey, customerKey, productId, mode }: Props) {
  const t = useTranslations();
  const en = useLocale() === 'en';
  const router = useRouter();
  const calledRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<SuccessData | null>(null);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!authKey || !customerKey) {
      setStatus('error');
      setError(t('payment.missingInfo'));
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setError(t('payment.sessionExpired'));
          return;
        }

        const apiUrl = mode === 'enable'
          ? '/api/payments/billing/enable'
          : '/api/payments/billing/register';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ authKey, customerKey, productId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || t('payment.processFailed'));

        setData({
          mode: body.mode || mode,
          productName: body.productName || 'PawDex Plus',
          period: body.period || 'month',
          nextBillingAt: body.nextBillingAt,
          amount: body.amount ?? null,
        });
        setStatus('success');

        // 2.5초 후 구독 관리 페이지로 이동. 유저가 정보 카드 읽을 시간 확보.
        setTimeout(() => router.push('/profile/subscription'), 2500);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'billing', action: 'billing-auth-callback' },
          extra: { customerKey, productId, mode },
        });
        setStatus('error');
        setError(err instanceof Error ? err.message : t('payment.processError2'));
      }
    })();
  }, [authKey, customerKey, productId, mode, router]);

  if (status === 'loading') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
        <h1 className="text-base font-bold text-gray-900 mb-1">{t('payment.processingShort')}</h1>
        <p className="text-sm text-gray-500">{t('payment.pleaseWait2')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <h1 className="text-base font-bold text-gray-900 mb-1">{t('payment.processFailed')}</h1>
        <p className="text-sm text-red-500 mb-6">{error}</p>
        <button
          onClick={() => router.push('/profile/subscription')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
        >
          {t('payment.goBack')}
        </button>
      </div>
    );
  }

  // success
  const productLabel = en
    ? (data?.period === 'year' ? t('payment.labelAnnual') : t('payment.labelMonthly'))
    : displayProductLabel(data);
  const title = data?.mode === 'enable' ? t('payment.titleEnable') : t('payment.titleRegister');
  const subtitle = data?.mode === 'enable'
    ? t('payment.subtitleEnable', { label: productLabel })
    : t('payment.subtitleRegister', { label: productLabel });

  const nextBillingLabel = data?.nextBillingAt
    ? formatDate(data.nextBillingAt, en)
    : '-';
  const amountLabel = data?.amount
    ? t('payment.amountWon', { amount: data.amount.toLocaleString() })
    : null;

  return (
    <div className="max-w-sm mx-auto px-4 py-12 text-center">
      {/* 🎉 타이틀 — (main) 레이아웃 헤더에 이미 PawDex 로고 있어서 중복 제거 */}
      <h1 className="text-lg font-bold text-gray-900 mb-6 leading-snug">
        {title}
      </h1>

      {/* 카드 — 블루 gradient */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-5 mb-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-sm">
          <CheckCircle2 className="text-blue-600" size={28} />
        </div>
        <p className="text-sm font-bold text-gray-800 mb-4 leading-relaxed">
          {subtitle}
        </p>
        <div className="bg-white/70 rounded-xl px-4 py-3 text-left">
          <p className="text-[11px] text-gray-500 mb-0.5">{t('payment.nextBilling')}</p>
          <p className="text-sm font-bold text-gray-800">
            {nextBillingLabel}
            {amountLabel && <span className="text-gray-600 font-medium"> · {amountLabel}</span>}
          </p>
        </div>
      </div>

      {/* 하단 힌트 */}
      <p className="text-xs text-gray-400">{t('payment.redirecting')}</p>
    </div>
  );
}

/**
 * DB 의 "PawDex Plus 월간 자동 결제" 같은 긴 이름을 "Plus 월간" 식으로 짧게.
 */
function displayProductLabel(data: SuccessData | null): string {
  if (!data) return 'Plus';
  return data.period === 'year' ? 'Plus 연간' : 'Plus 월간';
}

/**
 * ISO → locale 날짜. KO "2026. 05. 21" / EN "May 21, 2026".
 */
function formatDate(iso: string, en: boolean): string {
  try {
    const d = new Date(iso);
    if (en) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}. ${m}. ${day}`;
  } catch {
    return iso;
  }
}
