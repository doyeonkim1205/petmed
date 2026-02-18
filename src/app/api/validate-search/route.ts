import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const REJECT = { valid: false, reason: '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요. (예: 구토, 슬개골 탈구, 피부염)' };

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(REJECT);
    }

    const { query } = await request.json();
    if (!query || query.trim().length < 1) {
      return NextResponse.json(REJECT);
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `너는 반려동물 건강 검색 필터야. 사용자가 입력한 검색어가 강아지 또는 고양이의 질병, 증상, 건강 문제, 의학 용어에 해당하는지 엄격하게 판단해.

반드시 JSON으로만 응답: {"valid": true} 또는 {"valid": false, "reason": "이유"}

valid: true로 판단하는 경우 (허용):
- 동물 질병명 (예: 슬개골 탈구, 림프종, 신부전)
- 동물 증상 (예: 구토, 설사, 기침, 혈뇨)
- 의학/수의학 용어 (예: 피부염, 당뇨, 백내장)
- 동물 건강 관련 키워드 (예: 예방접종, 중성화, 구충제)

valid: false로 판단하는 경우 (차단):
- 의미 없는 글자/단어 (예: ㅋㅋ, ㅎㅎ, 뭐하냐, 데레렛, asdf)
- 반려동물 건강과 무관한 주제 (예: 날씨, 맛집, 게임, 영화)
- 사람 인사/대화 (예: 안녕, 뭐해, 고마워)
- 욕설, 비속어
- 알 수 없는 단어, 오타로 보이는 의미 없는 문자열

확실히 동물 건강/의학 관련이라고 판단되는 경우에만 valid: true를 반환해. 애매하면 false.
reason은 한국어로 짧게 안내.`,
          },
          {
            role: 'user',
            content: query.trim(),
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(REJECT);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(REJECT);

    const parsed = JSON.parse(content);
    return NextResponse.json({
      valid: !!parsed.valid,
      reason: parsed.reason || REJECT.reason,
    });
  } catch {
    return NextResponse.json(REJECT);
  }
}
