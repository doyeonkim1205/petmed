import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizedDiseaseMap, normalizedDiseaseKeysByLength } from '@/data/diseaseMap';
import { normalizeQuery } from '@/lib/normalizeQuery';
import { checkBannedWords } from '@/data/bannedWords';
import { verifyAuth } from '@/lib/apiAuth';
import { sanitizeForLLM } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rateLimit';
import { localeFromRequest } from '@/lib/aiLocale';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const rejectReason = (en: boolean) =>
  en ? 'Please enter a search term related to a pet disease or symptom.'
     : '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.';
const rejectBody = (en: boolean) => ({ valid: false, reason: rejectReason(en) });

/**
 * 검색어 검증 + 영문 번역을 하나의 OpenAI 호출로 처리
 * - diseaseMap에 있으면 OpenAI 호출 없이 즉시 반환
 * - 없으면 GPT-4o-mini로 검증 + 번역을 동시에 처리
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;
    const en = localeFromRequest(request) === 'en';

    // 분 단위 burst 방어 (line 67 아래 기존 30/hour DB 체크는 유지 — 두 단계 방어)
    if (!checkRateLimit(`${userId}:validate-and-translate`, 10, 60_000)) {
      return NextResponse.json(
        { valid: false, reason: en ? 'Too many requests. Please try again shortly.' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    const { query, petType } = await request.json();
    if (!query || query.trim().length < 1 || query.length > 200) {
      return NextResponse.json(rejectBody(en));
    }

    const trimmed = query.trim();
    const pet = petType === 'dog' ? 'dog' : 'cat';
    const petLabel = pet === 'dog' ? '강아지' : '고양이';

    // 0) 금지어 체크 (OpenAI 호출 전, 비용 0원)
    if (checkBannedWords(trimmed)) {
      return NextResponse.json(rejectBody(en));
    }

    // 검색어 정규형(띄어쓰기 무시) — "신장 결석"/"신장결석" 을 같은 사전 항목에 매칭.
    //   (englishQuery·LLM 프롬프트에는 정규형이 아니라 원문 trimmed 를 사용)
    const normalized = normalizeQuery(trimmed);

    // 1) diseaseMap 정확 매치 → OpenAI 호출 없이 즉시 반환
    //    feline/canine 접두어 불필요 — PubMed 검색에서 MeSH 동물 필터 사용
    if (normalizedDiseaseMap[normalized]) {
      return NextResponse.json({ valid: true, englishQuery: normalizedDiseaseMap[normalized] });
    }

    // 2) diseaseMap 부분 매치 — 입력이 키를 포함하는 경우만 (가장 긴 키부터)
    for (const key of normalizedDiseaseKeysByLength) {
      if (normalized.includes(key)) {
        return NextResponse.json({ valid: true, englishQuery: normalizedDiseaseMap[key] });
      }
    }

    // 2.5) 영문 직통 — 한글이 없으면 OpenAI 번역을 건너뛰고 입력을 그대로 PubMed 쿼리로.
    //   파워유저(수의대생/수의사)가 정확한 영문 의학용어·논문 제목을 넣을 때 재번역
    //   왜곡을 막고 OpenAI 호출 비용/지연도 절약. 금지어는 위(0단계)에서 이미 차단.
    //   PubMed 구문 문자([](){}" 등) 인젝션은 pubmed.ts 의 sanitize 가 방어.
    if (!/[가-힣]/.test(trimmed)) {
      return NextResponse.json({ valid: true, englishQuery: trimmed });
    }

    // 3.5) Rate limit: max 30 OpenAI calls per hour per user
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCalls } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);
    if ((recentCalls || 0) >= 30) {
      return NextResponse.json({ valid: false, reason: en ? 'Please try again later. (rate limit exceeded)' : '잠시 후 다시 시도해주세요. (요청 한도 초과)' });
    }

    // 4) OpenAI로 검증 + 번역을 한 번에 처리 (동물 종 포함)
    if (!OPENAI_API_KEY) {
      return NextResponse.json(rejectBody(en));
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      // 12s — 가끔 OpenAI 응답이 8s 를 살짝 넘길 때 false negative 가 생겨서 여유를 둠.
      // Vercel serverless 60s 상한 한참 안쪽.
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `너는 수의학 전문 PubMed MeSH 용어 번역가야.
현재 검색 대상 동물: ${petLabel}

사용자 입력이 의학/수의학/건강 관련 용어면 MeSH 표준 영문 용어로 번역해.
(PubMed 검색 단에서 "Cats"[Mesh] / "Dogs"[Mesh] 필터가 종을 분리하므로
 번역어 자체는 사람 의학 용어와 동일해도 상관없음.)

반드시 JSON으로만 응답:
- 유효: {"valid": true, "englishQuery": "MeSH 표준 영문 용어"}
- 무효: {"valid": false}

valid: true 기준 (관대하게 허용):
- 모든 의학 용어, 질병명, 증상, 건강 관련 키워드
- 사람 의학 용어여도 OK (종 특화 용어 생각나지 않으면 사람 의학 일반 MeSH 도 가능)
- ${petLabel}에서 흔하지 않은 질병이어도 의학 용어면 valid:true

valid: false 기준 (차단):
- 의미 없는 글자 (ㅋㅋ, ㅎㅎ, asdf, 데레렛)
- 인사/대화 (안녕, 뭐해, 반가워)
- 욕설, 비속어
- 의학과 명백히 무관한 주제 (음식 메뉴, 게임, 연예 등)

englishQuery 번역 규칙:
- ${petLabel} 에서 흔한 구체적 MeSH 용어가 있으면 우선 사용
  예시: 고양이+심장병→"Hypertrophic Cardiomyopathy", 강아지+심장병→"Mitral Valve Disease"
  예시: 고양이+감기→"Upper Respiratory Infection", 강아지+감기→"Kennel Cough"
- 종 특화가 애매하면 일반 MeSH 용어로 번역 (사람 의학 용어 사용 가능)
  예시: 강아지+천식→"Asthma" (강아지에 흔하지 않아도 번역은 해줌)
- PubMed MeSH에 등재된 공식 용어 사용
- feline/canine 접두어 붙이지 마 (PubMed 검색에서 자동으로 동물종 필터링함)
- 약어보다 정식 명칭 우선

핵심: 의학 용어면 일단 translate & valid:true. 쓸모없는 잡담/쓰레기일 때만 false.`,
          },
          {
            role: 'user',
            content: sanitizeForLLM(trimmed),
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(rejectBody(en));
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(rejectBody(en));

    const parsed = JSON.parse(content);

    if (parsed.valid && parsed.englishQuery) {
      return NextResponse.json({
        valid: true,
        englishQuery: parsed.englishQuery,
      });
    }

    return NextResponse.json(rejectBody(en));
  } catch {
    return NextResponse.json(rejectBody(localeFromRequest(request) === 'en'));
  }
}
