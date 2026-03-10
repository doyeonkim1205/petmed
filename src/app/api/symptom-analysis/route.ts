import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig } from '@/lib/plans';

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

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { symptoms, petType, followupAnswers } = await request.json();
    if (!symptoms || symptoms.length > 500) {
      return NextResponse.json({ error: 'Missing or too long symptoms' }, { status: 400 });
    }

    const isRefinement = Array.isArray(followupAnswers) && followupAnswers.length > 0;

    // Check refinement rate limit
    if (isRefinement) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();
      const plan = profile?.plan || 'free';
      const config = getPlanConfig(plan);
      const dailyLimit = config.symptomRefinePerDay;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count } = await supabaseAdmin
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', 'symptom.refine')
        .gte('created_at', startOfDay.toISOString());

      if ((count || 0) >= dailyLimit) {
        return NextResponse.json({
          error: `오늘의 재분석 횟수(${dailyLimit}회)를 모두 사용했습니다.${plan === 'free' ? ' 업그레이드하여 더 많은 재분석을 이용하세요.' : ''}`,
          limitReached: true,
        }, { status: 429 });
      }
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
            content: `우리 ${petLabel}가 이런 증상을 보입니다: "${symptoms}"${followupContext}`,
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
      diseases: (parsed.diseases ?? []).slice(0, 3),
      followup_questions: (parsed.followup_questions ?? []).slice(0, 3),
      emergency_signs: (parsed.emergency_signs ?? []).slice(0, 3),
    };

    // Log activity
    const { logActivity } = await import('@/lib/activityLog');
    logActivity(userId, isRefinement ? 'symptom.refine' : 'symptom.search', {
      details: {
        symptoms,
        petType,
        diseases: result.diseases.map((d: { name_ko: string }) => d.name_ko).join(', '),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Symptom analysis error:', error);
    return NextResponse.json({ error: '증상 분석에 실패했습니다.' }, { status: 500 });
  }
}
