import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

/**
 * 관리자 에러 패널 — Sentry Issues API 에서 최근 미해결 에러를 가져온다.
 *
 * 토큰: SENTRY_API_TOKEN (읽기 전용, scope project:read + event:read) 만 사용.
 *   ※ 빌드용 SENTRY_AUTH_TOKEN 은 소스맵 업로드 스코프라 issues 조회 시 403 →
 *     fallback 하면 "권한 부족" 으로 오인되므로 사용하지 않는다.
 * org/project: 환경변수 우선, 없으면 next.config 의 값 (dylabs / javascript-nextjs).
 *
 * 토큰 미설정이면 configured:false ("설정 필요"), 권한/오류면 명확한 error 메시지 반환.
 */
const ORG = process.env.SENTRY_ORG || 'dylabs';
const PROJECT = process.env.SENTRY_PROJECT || 'javascript-nextjs';

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const token = process.env.SENTRY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ configured: false, issues: [] });
  }

  const { searchParams } = new URL(request.url);
  const statsPeriod = ['24h', '14d', '90d'].includes(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : '24h';

  // Sentry Issues API: 미해결, 빈도순 상위 25.
  const url = `https://sentry.io/api/0/projects/${ORG}/${PROJECT}/issues/?query=${encodeURIComponent(
    'is:unresolved',
  )}&statsPeriod=${statsPeriod}&sort=freq&limit=25`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // 30초 캐시 — admin 새로고침 연타 시 Sentry rate limit 방어.
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const detail = res.status === 401
        ? '토큰이 유효하지 않습니다. SENTRY_API_TOKEN 값을 확인하고 재배포했는지 확인하세요.'
        : res.status === 403
          ? '토큰 권한이 부족합니다 (scope project:read + event:read 필요). 또는 Vercel 재배포가 필요합니다.'
          : res.status === 404
            ? `org/project slug 가 맞지 않습니다 (${ORG}/${PROJECT}).`
            : `Sentry 응답 오류 (${res.status})`;
      return NextResponse.json({ configured: true, error: detail, issues: [] }, { status: 200 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    const issues = (data || []).map((it) => ({
      id: it.id,
      title: it.title || it.metadata?.value || it.culprit || '(제목 없음)',
      culprit: it.culprit || '',
      level: it.level || 'error',
      count: Number(it.count) || 0,
      userCount: Number(it.userCount) || 0,
      firstSeen: it.firstSeen,
      lastSeen: it.lastSeen,
      permalink: it.permalink,
    }));

    return NextResponse.json({ configured: true, period: statsPeriod, issues });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : 'Sentry 조회 실패', issues: [] },
      { status: 200 },
    );
  }
}
