import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request, { skipDeviceCheck: true });
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const { action, details } = await request.json();
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action,
      details: details || {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
