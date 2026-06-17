import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl (라우팅 없음) — 쿠키 기반 locale. request 설정 경로 지정.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
      // Toss SDK는 js.tosspayments.com 외에도 event/stsevent/static 서브도메인에서 스크립트 로드 →
      // *.tosspayments.com 와일드카드로 포괄.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net https://*.tosspayments.com https://*.toss.im https://*.sentry.io",
      "style-src 'self' 'unsafe-inline' https://*.tosspayments.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://*.tosspayments.com",
      // 빌링 등록 시 카드사 인증 flow 가 *.tosspayments.com + *.toss.im 여러 서브도메인을 거침 →
      // 와일드카드 필수. 안 그러면 "알 수 없는 에러 / 호출에 실패" 로 뜸.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.kakao.com https://dapi.kakao.com https://kapi.kakao.com https://t1.daumcdn.net https://*.tosspayments.com https://*.toss.im https://api.openai.com https://*.sentry.io https://*.ingest.sentry.io https://eutils.ncbi.nlm.nih.gov https://pubmed.ncbi.nlm.nih.gov",
      // 빌링 auth 팝업/리다이렉트 — 카드 3D-Secure 등 카드사 도메인까지 열어둠.
      "frame-src 'self' https://*.tosspayments.com https://*.toss.im",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.tosspayments.com https://*.toss.im",
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

export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'dylabs',
  project: 'javascript-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
});
