import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET: List saved analyses for the user (with saved papers)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { data: analyses, error } = await supabaseAdmin
    .from('saved_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('saved-analyses GET error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // Fetch saved papers for each analysis
  if (analyses && analyses.length > 0) {
    const analysisIds = analyses.map((a: any) => a.id);
    const { data: papers } = await supabaseAdmin
      .from('saved_papers')
      .select('*')
      .in('analysis_id', analysisIds)
      .order('created_at', { ascending: true });

    // Group papers by analysis_id
    const papersByAnalysis = new Map<string, any[]>();
    (papers || []).forEach((p: any) => {
      const list = papersByAnalysis.get(p.analysis_id) || [];
      list.push(p);
      papersByAnalysis.set(p.analysis_id, list);
    });

    analyses.forEach((a: any) => {
      a.saved_papers = papersByAnalysis.get(a.id) || [];
    });
  }

  return NextResponse.json(analyses || []);
}

/**
 * POST: Save an analysis result (precautions, ingredients only)
 * No plan limit — analysis results are free to save for paid users.
 * Returns the saved analysis (with id for subsequent paper saves).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  // Rate limit: 분당 저장 스팸 방어 (500편 상한과 별개의 burst 방어선)
  const { checkRateLimit } = await import('@/lib/rateLimit');
  if (!checkRateLimit(`${userId}:save-analysis`, 10, 60_000)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 },
    );
  }

  // Check plan — only paid users can save
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const { getEffectivePlan } = await import('@/lib/plans');
  const plan = getEffectivePlan(profile?.plan);
  if (plan === 'free') {
    return NextResponse.json(
      { error: '유료 구독자만 분석을 저장할 수 있습니다.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { query, petType, analysis, selectedPapers } = body;
  const kind: 'paper' | 'symptom_photo' =
    body.kind === 'symptom_photo' ? 'symptom_photo' : 'paper';

  // 사진 분석 저장 cap 검사 — 논문(saved_papers)과 동일 maxSavedAnalyses(500) 적용.
  // 일반 사용자 도달 거의 0 (월 10건 가정 4년+), 매크로 스팸 방어용.
  if (kind === 'symptom_photo') {
    const { getPlanConfig } = await import('@/lib/plans');
    const config = getPlanConfig(plan);
    if (config.maxSavedAnalyses > 0) {
      const { count } = await supabaseAdmin
        .from('saved_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'symptom_photo');
      if ((count || 0) >= config.maxSavedAnalyses) {
        return NextResponse.json(
          { error: `사진 분석 저장 한도(${config.maxSavedAnalyses}개)에 도달했습니다.\n추가 용량이 필요하시면 문의해 주세요.`, limitReached: true },
          { status: 403 },
        );
      }
    }
  }

  // 사진 분석 (kind='symptom_photo') 은 analysis 객체 전체를 그대로 저장.
  // 논문 분석 (kind='paper') 은 precautions / ingredients 만 추려 저장.
  const analysisPayload = kind === 'symptom_photo'
    ? analysis ?? {}
    : {
        precautions: analysis?.precautions || [],
        ingredients: analysis?.ingredients || [],
      };

  const { data, error } = await supabaseAdmin
    .from('saved_analyses')
    .insert({
      user_id: userId,
      query,
      pet_type: petType,
      articles: [],
      analysis: analysisPayload,
      kind,
    })
    .select()
    .single();

  if (error) {
    console.error('saved-analyses POST error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // Save selected papers if any (논문 분석에만 해당)
  let savedPaperCount = 0;
  if (kind === 'paper' && selectedPapers && selectedPapers.length > 0 && data) {
    const { getPlanConfig } = await import('@/lib/plans');
    const config = getPlanConfig(plan);

    // Check paper limit (0 = unlimited)
    let papersToSave = selectedPapers;
    let remaining = Infinity;

    if (config.maxSavedAnalyses > 0) {
      const { count: currentCount } = await supabaseAdmin
        .from('saved_papers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      remaining = config.maxSavedAnalyses - (currentCount || 0);
      papersToSave = selectedPapers.slice(0, Math.max(0, remaining));
    }

    if (papersToSave.length > 0) {
      const rows = papersToSave.map((p: any) => ({
        user_id: userId,
        analysis_id: data.id,
        query,
        pet_type: petType,
        pmid: p.pmid,
        title: p.title,
        title_ko: p.titleKo || null,
        summary: p.summary || null,
        journal: p.journal || null,
        pub_date: p.pubDate || null,
      }));

      const { error: paperError } = await supabaseAdmin
        .from('saved_papers')
        .insert(rows);

      if (paperError) {
        console.error('saved-papers INSERT error:', paperError.message);
      } else {
        savedPaperCount = papersToSave.length;
      }
    }

    if (remaining <= 0) {
      // 여기는 plan === 'plus' 일 때만 도달 (free 는 위에서 이미 403).
      return NextResponse.json({
        ...data,
        savedPaperCount: 0,
        warning: `📌 논문 저장 한도(${config.maxSavedAnalyses}편)에 도달했습니다. 추가 용량이 필요하시면 문의해 주세요.`,
      });
    }

    if (papersToSave.length < selectedPapers.length) {
      return NextResponse.json({
        ...data,
        savedPaperCount,
        warning: `📌 논문 저장 한도로 ${papersToSave.length}편만 저장되었습니다.`,
      });
    }
  }

  const { logActivity } = await import('@/lib/activityLog');
  logActivity(userId, 'analysis.save', { details: { query, petType, paperCount: savedPaperCount } });

  return NextResponse.json({ ...data, savedPaperCount });
}

/**
 * DELETE: Remove a saved analysis (and its papers via CASCADE)
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

  const { logActivity } = await import('@/lib/activityLog');
  logActivity(auth.user!.id, 'analysis.delete', { resourceId: id });

  return NextResponse.json({ success: true });
}
