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

    const { diseaseName, petType } = await request.json();
    if (!diseaseName) {
      return NextResponse.json({ error: 'Missing diseaseName' }, { status: 400 });
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
            content: `너는 수의학 질병 설명 전문가야. ${petLabel} 보호자가 이해할 수 있도록 간결하게 설명해.

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
            content: `${petLabel}의 "${diseaseName}"에 대해 설명해줘.`,
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

    return NextResponse.json({
      name_ko: parsed.name_ko ?? diseaseName,
      name_en: parsed.name_en ?? '',
      description: parsed.description ?? '',
      symptoms: (parsed.symptoms ?? []).slice(0, 5),
      when_to_visit: parsed.when_to_visit ?? '',
    });
  } catch (error) {
    console.error('Disease description error:', error);
    return NextResponse.json({ error: '질병 설명 생성 실패' }, { status: 500 });
  }
}
