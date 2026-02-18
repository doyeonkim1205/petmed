import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      // API key 없으면 검증 스킵 (검색 허용)
      return NextResponse.json({ valid: true });
    }

    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ valid: false, reason: '검색어를 입력해주세요.' });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 50,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `사용자가 입력한 검색어가 반려동물(강아지/고양이)의 질병, 증상, 건강 문제와 관련이 있는지 판단해.
반드시 JSON으로만 응답: {"valid": true} 또는 {"valid": false, "reason": "이유"}
- valid가 true: 반려동물 건강/질병/증상 관련 검색어
- valid가 false: 관련 없는 검색어 (음식, 날씨, 게임 등)
- reason: 한국어로 짧게 설명 (예: "반려동물 질병과 관련 없는 검색어입니다. 증상이나 질병명을 입력해주세요.")`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
      }),
    });

    if (!res.ok) {
      // OpenAI 실패 시 검증 스킵
      return NextResponse.json({ valid: true });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{"valid": true}';
    return NextResponse.json(JSON.parse(content));
  } catch {
    // 에러 시 검증 스킵
    return NextResponse.json({ valid: true });
  }
}
