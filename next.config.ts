import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async headers() {
    // Content-Security-Policy:
    //   외부 스크립트/이미지/연결 화이트리스트로 XSS 공격 시 데이터 탈취 경로 차단.
    //   필수 도메인:
    //     - script: Kakao Maps SDK (dapi.kakao.com, t1.daumcdn.net) + Toss (js.tosspayments.com)
    //     - connect: Supabase, Kakao API, Toss API, OpenAI, PubMed, Sentry
    //     - frame: Toss 결제 iframe
    //     - img: 유저 업로드 + 카카오 아바타 등 모든 https 허용
    //   'unsafe-inline' / 'unsafe-eval' 은 Next.js 런타임 + Toss SDK 요구 — 제거 불가.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net https://js.tosspayments.com https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.kakao.com https://dapi.kakao.com https://kapi.kakao.com https://t1.daumcdn.net https://api.tosspayments.com https://api.openai.com https://*.sentry.io https://*.ingest.sentry.io https://eutils.ncbi.nlm.nih.gov https://pubmed.ncbi.nlm.nih.gov",
      "frame-src 'self' https://js.tosspayments.com https://*.tosspayments.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/community',
        destination: '/records',
        permanent: true,
      },
      {
        source: '/community/:path*',
        destination: '/records',
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'dylabs',
  project: 'javascript-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
});
