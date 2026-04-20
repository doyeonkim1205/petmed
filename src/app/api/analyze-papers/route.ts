import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { sanitizeForLLM } from '@/lib/sanitize';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 단일 배치 AI 분석 호출
 */
async function analyzeBatch(
  papers: any[],
  diseaseName: string,
  petType: string,
  apiKey: string,
) {
  const petLabel = petType === 'cat' ? '고양이' : '강아지';

  const papersText = papers
    .map((p: any, i: number) => {
      let entry = `[논문 ${i + 1}] ${p.title}\n저널: ${p.journal} | 발행일: ${p.pubDate}`;
      if (p.abstract && p.abstract !== 'Abstract not available.') {
        const trimmedAbstract = p.abstract.length > 1500
          ? p.abstract.slice(0, 1500) + '...'
          : p.abstract;
        entry += `\n초록: ${trimmedAbstract}`;
      }
      return entry;
    })
    .join('\n\n');

  const hasAbstracts = papers.some((p: any) => p.abstract && p.abstract !== 'Abstract not available.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `너는 수의학 논문 분석 전문가야. 사용자가 제공하는 PubMed 논문 정보${hasAbstracts ? '(초록 포함)' : ''}를 바탕으로 반드시 아래 JSON 형식으로만 응답해.

{
  "titles": ["논문1 제목 한국어 번역", ...],
  "summaries": ["논문1 요약", ...],
  "relevant": [true, false, ...],
  "precautions": ["주의사항1", ...],
  "ingredients": ["성분1", ...]
}

★ 관련성 판단 (가장 중요):
- relevant: 각 논문이 "${diseaseName}"을 직접적으로 다루는 논문인지 true/false 배열.
  - true: 논문의 주제 자체가 "${diseaseName}"의 진단, 치료, 예후, 관리에 관한 것
  - false: "${diseaseName}"을 단순 언급만 하거나, 간접적으로 관련되거나, 다른 주제의 논문
- precautions와 ingredients는 relevant=true인 논문에서만 추출해. relevant=false 논문의 내용은 무시해.

규칙:
- titles: 각 논문의 영문 제목을 자연스러운 한국어로 번역. 논문 수와 동일한 개수.
- summaries: ${hasAbstracts ? '초록 내용을 기반으로' : '논문 제목을 기반으로'} 각 논문을 ${petLabel} 보호자가 이해할 수 있게 한국어 2-3문장으로 요약. 논문 수와 동일한 개수. ${hasAbstracts ? '초록의 구체적 수치, 결과, 결론을 포함.' : ''}
- precautions: relevant=true 논문들을 종합하여 ${petLabel}의 "${diseaseName}"에 대한 주의사항/대처방법 최대 5개. 여러 논문 공통 내용 우선. 구체적이고 실용적인 조언.
- ingredients: relevant=true 논문에서 언급된 도움되는 성분/영양소/치료물질 최대 5개. "성분명 (한국어 설명)" 형식.
- 논문 초록/제목에 직접적 근거 없는 내용은 절대 포함 금지. 추측이나 일반 상식으로 채우지 마.`,
        },
        {
          role: 'user',
          content: `${petLabel}의 "${diseaseName}"에 대한 PubMed 논문 ${papers.length}편입니다. 각 논문을 개별적으로 요약하고, 전체를 종합하여 주의사항과 도움되는 성분을 추출해주세요.\n\n${papersText}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { diseaseName, petType, papers } = await request.json();

    if (!diseaseName || diseaseName.length > 200 || !papers || papers.length === 0 || papers.length > 20) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sanitized = sanitizeForLLM(diseaseName);
    const pet = petType === 'cat' ? 'cat' : 'dog';

    // Rate limit: max 15 per hour per user
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'papers.analyze')
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 15) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요. (요청 한도 초과)' }, { status: 429 });
    }

    // Check cache (30-day TTL)
    const pmids = papers.map((p: { pmid: string }) => p.pmid).sort().join(',');
    const cacheKey = `paper_analysis:${sanitized}:${pet}:${pmids}`;
    const ttl = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabaseAdmin
      .from('search_cache')
      .select('analysis')
      .eq('cache_key', cacheKey)
      .gt('created_at', ttl)
      .maybeSingle();
    if (cached?.analysis) {
      return NextResponse.json(cached.analysis);
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId, action: 'papers.analyze',
      details: { diseaseName: sanitized, petType: pet, paperCount: papers.length },
    });

    // 논문 6편 이상이면 2-batch 병렬 분석
    if (papers.length > 5) {
      const mid = Math.ceil(papers.length / 2);
      const batch1 = papers.slice(0, mid);
      const batch2 = papers.slice(mid);

      const [result1, result2] = await Promise.all([
        analyzeBatch(batch1, diseaseName, petType, OPENAI_API_KEY),
        analyzeBatch(batch2, diseaseName, petType, OPENAI_API_KEY),
      ]);

      // 배열 결과 병합 (titles, summaries, relevant는 순서대로 연결)
      const mergedTitles = [...(result1.titles ?? []), ...(result2.titles ?? [])];
      const mergedSummaries = [...(result1.summaries ?? []), ...(result2.summaries ?? [])];
      const mergedRelevant = [...(result1.relevant ?? []), ...(result2.relevant ?? [])];

      // precautions, ingredients는 양쪽 합쳐서 최대 5개
      const allPrecautions = [...(result1.precautions ?? []), ...(result2.precautions ?? [])];
      const allIngredients = [...(result1.ingredients ?? []), ...(result2.ingredients ?? [])];

      const mergedResult = {
        titles: mergedTitles,
        summaries: mergedSummaries,
        relevant: mergedRelevant,
        precautions: allPrecautions.slice(0, 5),
        ingredients: allIngredients.slice(0, 5),
      };
      await supabaseAdmin.from('search_cache').upsert(
        { cache_key: cacheKey, query: sanitized, pet_type: pet, analysis: mergedResult, created_at: new Date().toISOString() },
        { onConflict: 'cache_key' },
      ).then(() => {});
      return NextResponse.json(mergedResult);
    }

    // 5편 이하는 단일 호출
    const parsed = await analyzeBatch(papers, sanitized, petType, OPENAI_API_KEY);
    const singleResult = {
      titles: parsed.titles ?? [],
      summaries: parsed.summaries ?? [],
      relevant: parsed.relevant ?? [],
      precautions: (parsed.precautions ?? []).slice(0, 5),
      ingredients: (parsed.ingredients ?? []).slice(0, 5),
    };
    await supabaseAdmin.from('search_cache').upsert(
      { cache_key: cacheKey, query: sanitized, pet_type: pet, analysis: singleResult, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' },
    ).then(() => {});
    return NextResponse.json(singleResult);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'openai', action: 'analyze-papers' },
    });
    console.error('Paper analysis error:', error);
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
