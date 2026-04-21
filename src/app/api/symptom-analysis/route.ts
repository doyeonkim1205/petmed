import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { sanitizeForLLM } from '@/lib/sanitize';
import { startOfDayKST } from '@/lib/dailyBoundary';
import { checkRateLimit } from '@/lib/rateLimit';

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

    // 분 단위 burst 방어. 일일 한도와 별개로 초단위 스팸 차단.
    // 10 req/min 은 정상 유저가 절대 넘을 수 없는 값. 매크로만 걸림.
    if (!checkRateLimit(`${userId}:symptom-analysis`, 10, 60_000)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { symptoms, petType, followupAnswers } = await request.json();
    if (!symptoms) {
      return NextResponse.json({ error: 'Missing symptoms' }, { status: 400 });
    }

    const isRefinement = Array.isArray(followupAnswers) && followupAnswers.length > 0;

    // Get user plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    const plan = getEffectivePlan(profile?.plan);
    const config = getPlanConfig(plan);

    // Plan-based character limit
    if (symptoms.length > config.maxSymptomLength) {
      return NextResponse.json({
        error: `증상 입력은 최대 ${config.maxSymptomLength}자까지 가능합니다.${plan === 'free' ? ' 업그레이드하면 500자까지 입력할 수 있어요.' : ''}`,
      }, { status: 400 });
    }

    const startOfDay = startOfDayKST();

    // Rate limit check
    const kind = isRefinement ? 'symptom_refine' : 'symptom';
    const dailyLimit = isRefinement ? config.symptomRefinePerDay : config.symptomSearchPerDay;

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind)
      .gte('created_at', startOfDay.toISOString());

    if ((count || 0) >= dailyLimit) {
      const label = isRefinement ? '재분석' : '증상 분석';
      // `\n` 기준 두 줄 구성 — 클라이언트가 split 해서 둘째 줄은 작게 렌더.
      return NextResponse.json({
        error: `오늘의 ${label} 횟수(${dailyLimit}회)를 모두 사용했습니다.\n밤 12시(자정)에 초기화됩니다.`,
        limitReached: true,
      }, { status: 429 });
    }

    const petLabel = petType === 'cat' ? '고양이' : '강아지';

    // Build follow-up context for refined analysis
    let followupContext = '';
    if (isRefinement) {
      const answersText = followupAnswers
        .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n');
      followupContext = `\n\n보호자가 추가 질문에 답변했습니다:\n${answersText}\n\n이 추가 정보를 반영하여 더 정확하게 분석해줘. 이전 분석을 완전히 대체하는 새로운 분석을 제공해.`;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `너는 수의학 증상 분석 전문가야. ${petLabel} 보호자가 설명하는 증상을 바탕으로 가능한 질병을 예측하고, 보호자가 이해할 수 있도록 쉽게 설명해.

반드시 아래 JSON 형식으로만 응답해:
{
  "diseases": [
    {
      "name_ko": "의심 질병명 (한국어)",
      "name_en": "English name",
      "likelihood": "높음" | "중간" | "낮음",
      "severity": "긴급" | "주의" | "관찰",
      "description": "이 질병이 의심되는 이유와 간단한 설명 (2-3문장)",
      "matching_symptoms": ["입력된 증상 중 이 질병과 일치하는 것들"],
      "additional_symptoms": ["이 질병이라면 추가로 나타날 수 있는 증상들"],
      "action": "보호자가 지금 해야 할 행동 (1-2문장)"
    }
  ],
  "followup_questions": [
    {
      "question": "질문 내용",
      "type": "yes_no" | "select" | "text",
      "options": ["선택지1", "선택지2"]
    }
  ],
  "emergency_signs": ["이런 증상이 동반되면 즉시 병원에 가야 합니다"]
}

규칙:
- diseases는 가능성 높은 순으로 최대 3개
- severity 기준: "긴급"=즉시 병원, "주의"=1-2일 내 병원, "관찰"=경과 관찰 가능
- 추측이 아닌 수의학적 근거에 기반
- 전문 용어 사용 시 괄호 안에 쉬운 설명 추가
- emergency_signs는 최대 3개
- followup_questions는 최대 3개
- followup_questions의 type 설명:
  - "yes_no": 예/아니오로 답할 수 있는 질문 (options 불필요)
  - "select": 보기 중 선택하는 질문 (options에 2-5개 선택지 필수)
  - "text": 자유 입력이 필요한 질문 (options 불필요)
- 질문 유형은 질문 내용에 맞게 적절히 선택해${isRefinement ? '\n- 이전에 했던 질문과 다른 새로운 질문을 해줘' : ''}`,
          },
          {
            role: 'user',
            content: `우리 ${petLabel}가 이런 증상을 보입니다: "${sanitizeForLLM(symptoms)}"${followupContext}`,
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

    // 성공한 분석만 카운트 (사용량 차감). 질병 검색과 통일된 search_logs 에 기록.
    //
    // Dedup: 비행기 모드 등으로 클라가 응답을 못 받고 재시도할 때, 서버 쪽에선
    // 1차 요청이 이미 OpenAI 호출 + INSERT 까지 완료한 상태일 수 있음. 재요청
    // 은 이걸 모르고 또 INSERT → 카운트 중복 차감. 최근 60초 내 같은
    // (user_id, kind, query) 로그가 있으면 INSERT 를 스킵해서 보호.
    // OpenAI 호출은 어쨌든 2번 일어나지만 (유저 결과 보장용) 내부 비용일 뿐.
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentDupe } = await supabaseAdmin
      .from('search_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('query', symptoms)
      .gte('created_at', sixtySecAgo)
      .limit(1)
      .maybeSingle();

    if (!recentDupe) {
      await supabaseAdmin.from('search_logs').insert({
        user_id: userId,
        query: symptoms,
        pet_type: petType,
        kind,
      });
    }

    // 삽입 직후의 카운트를 응답에 포함 → 클라 배지 즉시 갱신.
    // 별도 GET /api/symptom-usage 없이도 race 없이 정확한 값 전달.
    // dedup 이 걸렸으면 count 그대로, 아니면 +1.
    const newUsed = recentDupe ? (count || 0) : (count || 0) + 1;

    const result = {
      diseases: (parsed.diseases ?? []).slice(0, 3),
      followup_questions: (parsed.followup_questions ?? []).slice(0, 3),
      emergency_signs: (parsed.emergency_signs ?? []).slice(0, 3),
      usage: {
        kind,
        used: newUsed,
        limit: dailyLimit,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'openai', action: 'symptom-analysis' },
    });
    console.error('Symptom analysis error:', error);
    return NextResponse.json({ error: '증상 분석에 실패했습니다.' }, { status: 500 });
  }
}
