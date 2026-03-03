import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

export async function POST(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { endpoint, keys_p256dh, keys_auth } = await request.json();
  if (!endpoint || !keys_p256dh || !keys_auth) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user!.id, endpoint, keys_p256dh, keys_auth },
      { onConflict: 'user_id,endpoint' }
    );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { user, error } = await verifyAuth(request);
  if (error) return error;

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: '엔드포인트가 필요합니다.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user!.id)
    .eq('endpoint', endpoint);

  return NextResponse.json({ success: true });
}
