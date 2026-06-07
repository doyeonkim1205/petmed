import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

/**
 * 관리자 대시보드 트래픽 추세 — 가입/검색/매출 시계열 (KST 버킷, gap-fill).
 * get_trends(p_bucket, p_count) RPC 사용.
 *   - bucket: day | week | month (그 외는 day 로 coerce)
 *   - count: 버킷 개수 (기본 day=30, week=12, month=12)
 */
export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('bucket') || 'day';
  const bucket = ['day', 'week', 'month'].includes(raw) ? raw : 'day';
  const defaultCount = bucket === 'day' ? 30 : 12;
  const count = Math.min(Math.max(parseInt(searchParams.get('count') || String(defaultCount)) || defaultCount, 1), 366);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error: rpcError } = await supabase.rpc('get_trends', {
    p_bucket: bucket,
    p_count: count,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // bigint 는 문자열로 옴 → number 변환.
  const trends = (data || []).map((r: { bucket: string; signups: number | string; searches: number | string; revenue: number | string }) => ({
    bucket: r.bucket,
    signups: Number(r.signups) || 0,
    searches: Number(r.searches) || 0,
    revenue: Number(r.revenue) || 0,
  }));

  return NextResponse.json({ bucket, count, trends });
}
