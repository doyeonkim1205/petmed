import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { symptoms, petType } = await request.json();
    if (!symptoms || symptoms.length > 500) {
      return NextResponse.json({ error: 'Missing or too long symptoms' }, { status: 400 });
    }

    const petLabel = petType === 'cat' ? '고양이' : '강아지';

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
  "followup_questions": ["정확도를 높이기 위해 보호자에게 물어볼 추가 질문 2-3개"],
  "emergency_signs": ["이런 증상이 동반되면 즉시 병원에 가야 합니다"]
}

규칙:
- diseases는 가능성 높은 순으로 최대 3개
- severity 기준: "긴급"=즉시 병원, "주의"=1-2일 내 병원, "관찰"=경과 관찰 가능
- 추측이 아닌 수의학적 근거에 기반
- 전문 용어 사용 시 괄호 안에 쉬운 설명 추가
- emergency_signs는 최대 3개
- followup_questions는 최대 3개`,
          },
          {
            role: 'user',
            content: `우리 ${petLabel}가 이런 증상을 보입니다: "${symptoms}"`,
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
    const userId = auth.user!.id;
    logActivity(userId, 'symptom.search', {
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
