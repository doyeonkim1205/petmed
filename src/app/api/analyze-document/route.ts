import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const isImage = file.type.startsWith('image/');
    const mediaType = file.type;

    const messages: any[] = [
      {
        role: 'system',
        content: `너는 동물병원 진료 기록 분석 전문가야. 사용자가 제공하는 진료 기록서/영수증 이미지를 분석하여 반드시 아래 JSON 형식으로만 응답해.

{
  "hospital_name": "병원명 또는 null",
  "visit_date": "YYYY-MM-DD 또는 null",
  "diagnosis": "진단명 또는 null",
  "treatments": ["처치1", "처치2"],
  "medications": [
    {"name": "약명", "dosage": "용량 또는 null", "frequency": "투약빈도 또는 null", "duration": "기간 또는 null"}
  ],
  "cost": 숫자(원) 또는 null,
  "summary": "진료 내용 한 줄 요약"
}

규칙:
- 이미지에서 읽을 수 없는 항목은 null로 설정
- 비용은 숫자만 (원 단위, 쉼표 없이)
- 날짜는 YYYY-MM-DD 형식
- 약 정보가 없으면 medications는 빈 배열
- 한국어로 응답`,
      },
    ];

    if (isImage) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: '이 동물병원 진료 기록/영수증을 분석해주세요.' },
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${base64}` },
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: '이 문서의 내용을 분석해주세요. (PDF 파일이 첨부되었습니다)',
      });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `AI 분석 실패: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Document analysis error:', error);
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
