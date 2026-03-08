import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET: Get user's saved paper count
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { count } = await supabaseAdmin
    .from('saved_papers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const config = getPlanConfig(plan);

  return NextResponse.json({
    count: count || 0,
    limit: config.maxSavedAnalyses,
    plan,
  });
}

/**
 * DELETE: Remove a saved paper
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { id } = await request.json();

  const { error } = await supabaseAdmin
    .from('saved_papers')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user!.id);

  if (error) {
    console.error('saved-papers DELETE error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
