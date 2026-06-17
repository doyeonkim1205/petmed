import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { sanitizeForLLM } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rateLimit';
import { localeFromRequest } from '@/lib/aiLocale';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;
    const locale = localeFromRequest(request);
    const en = locale === 'en';

    // 분 단위 burst 방어
    if (!checkRateLimit(`${userId}:disease-description`, 10, 60_000)) {
      return NextResponse.json(
        { error: en ? 'Too many requests. Please try again shortly.' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { diseaseName, petType } = await request.json();
    if (!diseaseName || diseaseName.length > 200) {
      return NextResponse.json({ error: 'Missing diseaseName' }, { status: 400 });
    }

    const pet = petType === 'cat' ? 'cat' : 'dog';
    const petLabel = pet === 'cat' ? '고양이' : '강아지';
    const sanitized = sanitizeForLLM(diseaseName);

    // Rate limit: max 20 per hour per user
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'disease.describe')
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 20) {
      return NextResponse.json({ error: en ? 'Please try again later. (rate limit exceeded)' : '잠시 후 다시 시도해주세요. (요청 한도 초과)' }, { status: 429 });
    }

    // Check cache (90-day TTL) — locale 포함 (EN/KO 캐시 분리, 교차 오염 방지)
    const cacheKey = `disease_desc:${sanitized}:${pet}:${locale}`;
    const ttl = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabaseAdmin
      .from('search_cache')
      .select('disease_description')
      .eq('cache_key', cacheKey)
      .gt('created_at', ttl)
      .maybeSingle();

    if (cached?.disease_description) {
      return NextResponse.json(cached.disease_description);
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId, action: 'disease.describe',
      details: { diseaseName: sanitized, petType: pet },
    });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: en
              ? `You are a veterinary disease explanation expert. Explain concisely so a ${pet === 'cat' ? 'cat' : 'dog'} guardian can understand. Respond in ENGLISH.

You MUST respond ONLY in the following JSON format:
{
  "name_ko": "the disease name in plain English",
  "name_en": "the scientific English name",
  "description": "a brief explanation of the disease (2-3 sentences, guardian-friendly English)",
  "symptoms": ["main symptom 1", "symptom 2", "symptom 3"],
  "when_to_visit": "when to see a vet (1 sentence)"
}

Rules:
- symptoms: up to 5
- When using technical terms, add a plain explanation in parentheses
- Do not speculate; provide only reliable information`
              : `너는 수의학 질병 설명 전문가야. ${petLabel} 보호자가 이해할 수 있도록 간결하게 설명해.

반드시 아래 JSON 형식으로만 응답해:
{
  "name_ko": "질병의 정확한 한국어 이름",
  "name_en": "English name",
  "description": "질병에 대한 간단한 설명 (2-3문장, 보호자 눈높이)",
  "symptoms": ["주요 증상1", "증상2", "증상3"],
  "when_to_visit": "병원에 가야 하는 시점 (1문장)"
}

규칙:
- symptoms는 최대 5개
- 전문 용어 사용 시 괄호 안에 쉬운 설명 추가
- 추측하지 말고 확실한 정보만 제공`,
          },
          {
            role: 'user',
            content: en
              ? `Explain "${sanitized}" in a ${pet === 'cat' ? 'cat' : 'dog'}.`
              : `${petLabel}의 "${sanitized}"에 대해 설명해줘.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `OpenAI API failed: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);

    const result = {
      name_ko: parsed.name_ko ?? diseaseName,
      name_en: parsed.name_en ?? '',
      description: parsed.description ?? '',
      symptoms: (parsed.symptoms ?? []).slice(0, 5),
      when_to_visit: parsed.when_to_visit ?? '',
    };

    // Save to cache (shared across all users)
    await supabaseAdmin.from('search_cache').upsert(
      { cache_key: cacheKey, query: sanitized, pet_type: pet, disease_description: result, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' },
    ).then(() => {});

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'openai', action: 'disease-description' },
    });
    console.error('Disease description error:', error);
    return NextResponse.json({ error: '질병 설명 생성 실패' }, { status: 500 });
  }
}
