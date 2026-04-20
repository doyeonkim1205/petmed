import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend(event, hint) {
    if (process.env.NODE_ENV !== 'production') return null;

    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String(error.message);
      if (
        msg.includes('ResizeObserver loop') ||
        msg.includes('Non-Error promise rejection') ||
        msg.includes('Network request failed')
      ) {
        return null;
      }
    }

    return event;
  },

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'The operation was aborted',
    'Load failed',
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
