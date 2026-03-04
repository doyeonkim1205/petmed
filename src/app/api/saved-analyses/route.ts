import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET: List saved analyses for the user
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('saved_analyses')
    .select('*')
    .eq('user_id', auth.user!.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('saved-analyses GET error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/**
 * POST: Save an analysis (basic + premium)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  // Check plan
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = profile?.plan || 'free';
  const config = getPlanConfig(plan);

  if (config.maxSavedAnalyses === 0 && plan === 'free') {
    return NextResponse.json(
      { error: '유료 구독자만 논문을 저장할 수 있습니다.' },
      { status: 403 },
    );
  }

  // Check limit for basic plan
  if (config.maxSavedAnalyses > 0) {
    const { count } = await supabaseAdmin
      .from('saved_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count || 0) >= config.maxSavedAnalyses) {
      const suffix = plan === 'premium' ? '추가 용량이 필요하시면 문의해 주세요.' : '업그레이드하여 더 많은 분석을 저장하세요.';
      return NextResponse.json(
        { error: `저장 한도(${config.maxSavedAnalyses}개)에 도달했습니다. ${suffix}` },
        { status: 403 },
      );
    }
  }

  const { query, petType, articles, analysis } = await request.json();

  const { data, error } = await supabaseAdmin
    .from('saved_analyses')
    .insert({
      user_id: userId,
      query,
      pet_type: petType,
      articles,
      analysis,
    })
    .select()
    .single();

  if (error) {
    console.error('saved-analyses POST error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE: Remove a saved analysis
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { id } = await request.json();

  const { error } = await supabaseAdmin
    .from('saved_analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user!.id);

  if (error) {
    console.error('saved-analyses DELETE error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
