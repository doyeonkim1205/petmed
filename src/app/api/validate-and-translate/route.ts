import { NextRequest, NextResponse } from 'next/server';
import { diseaseMap } from '@/data/diseaseMap';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const REJECT = {
  valid: false,
  reason: '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요. (예: 구토, 슬개골 탈구, 피부염)',
};

/**
 * 검색어 검증 + 영문 번역을 하나의 OpenAI 호출로 처리
 * - diseaseMap에 있으면 OpenAI 호출 없이 즉시 반환
 * - 없으면 GPT-4o-mini로 검증 + 번역을 동시에 처리
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query || query.trim().length < 1) {
      return NextResponse.json(REJECT);
    }

    const trimmed = query.trim();

    // 이미 영문이면 검증만 필요
    const isEnglish = /^[A-Za-z\s\-]+$/.test(trimmed);

    // 1) diseaseMap 정확 매치 → OpenAI 호출 없이 즉시 반환
    if (diseaseMap[trimmed]) {
      return NextResponse.json({ valid: true, englishQuery: diseaseMap[trimmed] });
    }

    // 2) diseaseMap 부분 매치 (가장 긴 키부터)
    const sortedKeys = Object.keys(diseaseMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (trimmed.includes(key) || key.includes(trimmed)) {
        return NextResponse.json({ valid: true, englishQuery: diseaseMap[key] });
      }
    }

    // 3) 영문인 경우 그대로 사용 (의학 용어일 가능성 높음)
    if (isEnglish && trimmed.length >= 3) {
      return NextResponse.json({ valid: true, englishQuery: trimmed });
    }

    // 4) OpenAI로 검증 + 번역을 한 번에 처리
    if (!OPENAI_API_KEY) {
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
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `너는 반려동물 건강 검색 필터 겸 의학 용어 번역가야.

사용자 입력이 강아지/고양이의 질병, 증상, 건강 문제, 의학/수의학 용어인지 판단하고,
유효하면 PubMed 검색에 적합한 영문 의학 용어로 번역해.

반드시 JSON으로만 응답:
- 유효: {"valid": true, "englishQuery": "영문 의학 용어"}
- 무효: {"valid": false, "reason": "한국어 거부 사유"}

valid: true 기준 (허용):
- 동물 질병명, 증상, 의학/수의학 용어, 건강 관련 키워드

valid: false 기준 (차단):
- 의미 없는 글자 (ㅋㅋ, ㅎㅎ, asdf, 데레렛)
- 반려동물 건강과 무관한 주제
- 인사/대화 (안녕, 뭐해, 뭐하냐)
- 욕설, 비속어, 오타

확실히 동물 건강/의학 관련일 때만 valid: true. 애매하면 false.
englishQuery는 PubMed에서 검색하기 좋은 정확한 영문 의학 용어로 번역.`,
          },
          {
            role: 'user',
            content: trimmed,
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

    if (parsed.valid && parsed.englishQuery) {
      return NextResponse.json({
        valid: true,
        englishQuery: parsed.englishQuery,
      });
    }

    return NextResponse.json({
      valid: false,
      reason: parsed.reason || REJECT.reason,
    });
  } catch {
    return NextResponse.json(REJECT);
  }
}
