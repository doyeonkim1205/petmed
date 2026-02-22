import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/**
 * POST: Save an analysis (premium only)
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

  if (profile?.plan !== 'premium') {
    return NextResponse.json(
      { error: '프리미엄 구독자만 논문을 저장할 수 있습니다.' },
      { status: 403 },
    );
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
