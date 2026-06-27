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

  const { data: analysesRaw, error } = await supabaseAdmin
    .from('saved_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('saved-analyses GET error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // 사진 분석 저장 기능 제거됨 — 보관함은 논문 분석(paper)만. 과거 symptom_photo row 가
  //   남아있어도 제외 (JS 필터라 legacy null kind = 논문 은 그대로 유지).
  const analyses = (analysesRaw || []).filter((a: any) => a.kind !== 'symptom_photo');

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
  // 사진 분석 저장 기능 제거됨 — 보관함은 논문 분석만 저장 가능.
  if (body.kind === 'symptom_photo') {
    return NextResponse.json({ error: '사진 분석 저장은 더 이상 지원하지 않습니다.' }, { status: 400 });
  }
  const kind = 'paper' as const;

  // 분석 저장 cap 검사 — kind 별로 각 maxSavedAnalyses(500) 적용.
  // 일반 사용자 도달 거의 0, 매크로 스팸 방어용.
  {
    const { getPlanConfig } = await import('@/lib/plans');
    const config = getPlanConfig(plan);
    if (config.maxSavedAnalyses > 0) {
      const { count } = await supabaseAdmin
        .from('saved_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', kind);
      if ((count || 0) >= config.maxSavedAnalyses) {
        return NextResponse.json(
          { error: `논문 분석 저장 한도(${config.maxSavedAnalyses}편)에 도달했습니다.\n추가 용량이 필요하시면 문의해 주세요.`, limitReached: true },
          { status: 403 },
        );
      }
    }
  }

  // 논문 분석 — precautions / ingredients 만 추려 저장.
  const analysisPayload = {
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
      // 완전 도달 (논문 0편 저장) — 클라이언트에서 빨강(error) 처리.
      return NextResponse.json({
        ...data,
        savedPaperCount: 0,
        warning: `논문 저장 한도(${config.maxSavedAnalyses}편)에 도달했습니다. 추가 용량이 필요하시면 문의해 주세요.`,
        warningKind: 'limit_reached',
      });
    }

    if (papersToSave.length < selectedPapers.length) {
      // 일부 잘림 — 클라이언트에서 주황(warning) 처리.
      return NextResponse.json({
        ...data,
        savedPaperCount,
        warning: `논문 저장 한도로 ${papersToSave.length}편만 저장되었습니다.`,
        warningKind: 'partial',
      });
    }
  }

  // 액션만 — 검색어(query)는 내용이라 제외, 비식별 메타만.
  const { logActivityServer } = await import('@/lib/activityLogServer');
  await logActivityServer(userId, 'analysis.save', { details: { petType, paperCount: savedPaperCount } });

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

  const { logActivityServer } = await import('@/lib/activityLogServer');
  await logActivityServer(auth.user!.id, 'analysis.delete', { resourceId: id });

  return NextResponse.json({ success: true });
}
