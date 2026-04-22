import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_SUGGESTIONS = 10;

/**
 * GET: 사용자의 최근 병원명 목록 (최근순, 최대 10개).
 * 약 기록 추가 화면의 자동완성 드롭다운에서 사용.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('recent_hospitals')
    .select('name')
    .eq('user_id', auth.user!.id)
    .order('last_used_at', { ascending: false })
    .limit(MAX_SUGGESTIONS);

  if (error) {
    console.error('recent-hospitals GET error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json((data || []).map((r: any) => r.name));
}

/**
 * POST: 병원명 저장/갱신 (upsert: 이미 있으면 last_used_at 만 touch).
 * 기록 저장 시 호출. names 배열로 받아서 한 번에 여러 개 처리 가능 (마이그레이션용).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const body = await request.json();
  const names: string[] = Array.isArray(body.names)
    ? body.names
    : typeof body.name === 'string' ? [body.name] : [];
  const cleaned = names
    .map(n => (typeof n === 'string' ? n.trim() : ''))
    .filter(n => n.length > 0 && n.length <= 100)
    .slice(0, MAX_SUGGESTIONS);
  if (cleaned.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // 배열 upsert: 같은 (user_id, name) 은 last_used_at 만 갱신.
  // 마이그레이션 케이스에선 시간 순서를 대충 맞추기 위해 ms 단위로 살짝 흩뿌림.
  const now = Date.now();
  const rows = cleaned.map((name, i) => ({
    user_id: userId,
    name,
    last_used_at: new Date(now - i).toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('recent_hospitals')
    .upsert(rows, { onConflict: 'user_id,name' });

  if (error) {
    console.error('recent-hospitals POST error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: cleaned.length });
}

/**
 * DELETE: 자동완성 드롭다운에서 개별 제거.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { name } = await request.json();
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name 이 필요합니다.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('recent_hospitals')
    .delete()
    .eq('user_id', auth.user!.id)
    .eq('name', name.trim());

  if (error) {
    console.error('recent-hospitals DELETE error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
