import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * CSP 위반 리포트 수집 엔드포인트.
 *
 * next.config 의 Content-Security-Policy(강제) 에 report-uri/report-to 로 연결.
 * 브라우저/WebView 가 CSP 위반 시 이 URL 로 POST → Sentry 로 로깅해 가시성 확보.
 * (강제 차단은 유지하면서, 무엇이 막히는지·XSS 주입 시도가 있는지 모니터링)
 *
 * 인증 없음(브라우저가 보내는 리포트 싱크). 확장프로그램發 노이즈는 필터링.
 */

// 브라우저 확장프로그램 등이 유발하는 노이즈(실제 위협 아님) 필터.
const NOISE = /^(chrome-extension|moz-extension|safari-extension|safari-web-extension|webkit-masked-url|about|data):/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 레거시(report-uri): { "csp-report": {...} } / 신형(report-to): [{ type, body }]
    const reports = Array.isArray(body) ? body : [body];
    for (const r of reports) {
      const v = r['csp-report'] || r.body || r;
      const directive = v['violated-directive'] || v.effectiveDirective || v.violatedDirective || 'unknown';
      const blocked = v['blocked-uri'] || v.blockedURL || v.blockedURI || '';
      const doc = v['document-uri'] || v.documentURL || '';
      if (NOISE.test(String(blocked))) continue; // 확장프로그램 노이즈 스킵
      Sentry.captureMessage(`CSP violation: ${directive} blocked ${blocked || '(inline/eval)'}`, {
        level: 'warning',
        tags: { feature: 'csp', directive: String(directive).split(/\s|;/)[0] },
        extra: { directive, blocked, doc, ua: request.headers.get('user-agent') },
      });
    }
  } catch {
    /* malformed report — 무시 */
  }
  // 리포트 싱크는 본문 없이 204
  return new NextResponse(null, { status: 204 });
}
