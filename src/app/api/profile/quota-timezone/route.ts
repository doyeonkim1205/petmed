import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// IANA 이름 형태 + 런타임이 실제로 아는 타임존인지 확인 (예: 'Asia/Seoul', 'America/New_York', 'Etc/GMT+9').
function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// POST /api/profile/quota-timezone  { timeZone }
//   일일/월간 한도 기준 타임존(profiles.quota_timezone)을 "비어 있을 때 1회만" 기록.
//   클라이언트 직접 UPDATE 는 DB 권한에서 회수 — 사용자가 값을 바꿔 가며 한도 창을 리셋하는 우회 차단.
//   이미 값이 있으면 아무것도 바꾸지 않고 { set: false } (재호출·동시호출 안전: WHERE quota_timezone IS NULL).
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  let body: { timeZone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!isValidTimeZone(body.timeZone)) {
    return NextResponse.json({ error: 'invalid timeZone' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ quota_timezone: body.timeZone })
    .eq('id', userId)
    .is('quota_timezone', null)
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ set: (data?.length ?? 0) > 0 });
}
