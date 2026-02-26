import { NextRequest, NextResponse } from 'next/server';
import { diseaseMap } from '@/data/diseaseMap';
import { checkBannedWords } from '@/data/bannedWords';
import { verifyAuth } from '@/lib/apiAuth';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const REJECT = {
  valid: false,
  reason: '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.',
};

/**
 * 검색어 검증 + 영문 번역을 하나의 OpenAI 호출로 처리
 * - diseaseMap에 있으면 OpenAI 호출 없이 즉시 반환
 * - 없으면 GPT-4o-mini로 검증 + 번역을 동시에 처리
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;

    const { query, petType } = await request.json();
    if (!query || query.trim().length < 1 || query.length > 200) {
      return NextResponse.json(REJECT);
    }

    const trimmed = query.trim();
    const pet = petType === 'dog' ? 'dog' : 'cat';
    const petLabel = pet === 'dog' ? '강아지' : '고양이';

    // 0) 금지어 체크 (OpenAI 호출 전, 비용 0원)
    if (checkBannedWords(trimmed)) {
      return NextResponse.json(REJECT);
    }

    // 1) diseaseMap 정확 매치 → OpenAI 호출 없이 즉시 반환
    //    feline/canine 접두어 불필요 — PubMed 검색에서 MeSH 동물 필터 사용
    if (diseaseMap[trimmed]) {
      return NextResponse.json({ valid: true, englishQuery: diseaseMap[trimmed] });
    }

    // 2) diseaseMap 부분 매치 — 입력이 키를 포함하는 경우만 (가장 긴 키부터)
    const sortedKeys = Object.keys(diseaseMap).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (trimmed.includes(key)) {
        return NextResponse.json({ valid: true, englishQuery: diseaseMap[key] });
      }
    }

    // 4) OpenAI로 검증 + 번역을 한 번에 처리 (동물 종 포함)
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
            content: `너는 수의학 전문 검색 필터 겸 PubMed MeSH 용어 번역가야.
현재 검색 대상 동물: ${petLabel}

사용자 입력이 ${petLabel}의 질병, 증상, 건강 문제, 수의학 용어인지 판단하고,
유효하면 PubMed MeSH(Medical Subject Headings) 표준 용어로 번역해.

반드시 JSON으로만 응답:
- 유효: {"valid": true, "englishQuery": "MeSH 표준 영문 용어"}
- 무효: {"valid": false}

valid: true 기준 (허용):
- 동물 질병명, 증상, 의학/수의학 용어, 건강 관련 키워드

valid: false 기준 (차단):
- 의미 없는 글자 (ㅋㅋ, ㅎㅎ, asdf, 데레렛)
- 반려동물 건강과 무관한 주제
- 인사/대화 (안녕, 뭐해, 뭐하냐)
- 욕설, 비속어, 오타

확실히 동물 건강/의학 관련일 때만 valid: true. 애매하면 false.

englishQuery 번역 규칙:
- ${petLabel}에서 가장 흔한/관련성 높은 정확한 질병명으로 번역
  예시: 고양이+심장병→"Hypertrophic Cardiomyopathy", 강아지+심장병→"Mitral Valve Disease"
  예시: 고양이+감기→"Upper Respiratory Infection", 강아지+감기→"Kennel Cough"
- PubMed MeSH에 등재된 공식 용어 사용
- feline/canine 접두어 붙이지 마 (PubMed 검색에서 자동으로 동물종 필터링함)
- 포괄적 용어보다 ${petLabel}에서 흔한 구체적 질병명 우선
- 약어보다 정식 명칭 우선`,
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

    return NextResponse.json(REJECT);
  } catch {
    return NextResponse.json(REJECT);
  }
}
