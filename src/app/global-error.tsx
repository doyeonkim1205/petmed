'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // global-error 는 root layout(NextIntlClientProvider 포함)을 통째로 대체하므로
  // next-intl 컨텍스트가 없다 → 쿠키를 직접 읽어 KO/EN 분기.
  const en = typeof document !== 'undefined' && /(?:^|;\s*)NEXT_LOCALE=en(?:;|$)/.test(document.cookie);

  return (
    <html lang={en ? 'en' : 'ko'}>
      <body style={{ margin: 0, backgroundColor: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '320px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/error-illustration.svg"
              alt={en ? 'Error illustration' : '에러 일러스트'}
              width={200}
              height={200}
              style={{ margin: '0 auto 16px', display: 'block' }}
            />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{en ? 'Oops, something went wrong!' : '앗, 문제가 발생했어요!'}</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6, marginBottom: '24px' }}>
              {en ? (
                <>This may be a temporary error.<br />Please try again shortly.<br />If it keeps happening, please relaunch the app.</>
              ) : (
                <>일시적인 오류일 수 있어요.<br />잠시 후 다시 시도해주세요.<br />문제가 계속되면 앱을 재실행해주세요.</>
              )}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {en ? 'Try again' : '다시 시도'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
