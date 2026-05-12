import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { sanitizeForLLM } from '@/lib/sanitize';
import { startOfDayKST } from '@/lib/dailyBoundary';
import { checkRateLimit } from '@/lib/rateLimit';
import { fetchPetContext, buildPetContextPrompt } from '@/lib/petContext';
import { lookupVetTerm } from '@/lib/vetTerms';

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

    const { symptoms, petType, petId, followupAnswers } = await request.json();
    if (!symptoms) {
      return NextResponse.json({ error: 'Missing symptoms' }, { status: 400 });
    }

    const isRefinement = Array.isArray(followupAnswers) && followupAnswers.length > 0;

    // 펫 컨텍스트 fetch — petId 옵셔널. 다른 유저 petId 면 silent fail (null 반환).
    // 보안: fetchPetContext 가 user_id 검증 포함.
    const petContext = petId ? await fetchPetContext(supabaseAdmin, userId, petId) : null;
    const petContextText = buildPetContextPrompt(petContext);
    // 펫 컨텍스트 사용 시 species 도 그 펫 기준으로 강제 동기화.
    // (클라이언트가 petType 따로 보내도 펫 정보가 우선)
    const effectivePetType = petContext?.pet.type ?? petType;
    const effectivePetName = petContext?.pet.name;

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

    const petLabel = effectivePetType === 'cat' ? '고양이' : '강아지';
    // 환자 호칭 — 펫 컨텍스트 있으면 이름 사용 ("우리 살구가"), 없으면 종 ("우리 강아지가")
    const patientLabel = effectivePetName ? `우리 ${effectivePetName}` : `우리 ${petLabel}`;

    // Build follow-up context for refined analysis
    let followupContext = '';
    if (isRefinement) {
      const answersText = followupAnswers
        .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n');
      followupContext = `\n\n보호자가 추가 질문에 답변했습니다:\n${answersText}\n\n이 추가 정보를 반영하여 더 정확하게 분석해줘. 이전 분석을 완전히 대체하는 새로운 분석을 제공해.`;
    }

    // 펫 컨텍스트 안내 블록 — 환자 정보가 있으면 user message 에 [환자 정보] 섹션
    // 형태로 주입. NULL 필드는 buildPetContextPrompt 에서 자동 생략됨.
    const petContextBlock = petContextText
      ? `\n\n${petContextText}\n\n위 환자 정보를 반영하여 분석해줘:
- 품종 호발 질병 우선 고려
- 만성질환과의 연관성 검토
- 복용 약물 부작용 가능성 검토
- 알레르기/금기 약물 회피 권고`
      : '';

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
      "name_ko": "한국어 표준 수의학 용어 (불확실하면 영문 그대로)",
      "name_en": "학술 영문명 (약어가 일반적이면 함께 — 예: 'Chronic Kidney Disease (CKD)')",
      "category": "임상 분류 (예: '비뇨기 질환', '소화기 질환', '피부 질환', '심혈관 질환', '내분비 질환', '호흡기 질환' — 확실할 때만)",
      "likelihood": "높음" | "중간" | "낮음",
      "severity": "긴급" | "주의" | "관찰",
      "description": "이 질병이 의심되는 이유와 간단한 설명 (2-3문장, 일상 용어)",
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
  "emergency_signs": [
    {
      "sign": "구체적이고 측정 가능한 응급 신호 (예: 분당 호흡수 40회 이상)",
      "severity": "즉시" | "24시간내",
      "reason": "왜 응급인지 짧은 설명 (1문장)"
    }
  ]
}

규칙:
- diseases는 가능성 높은 순으로 최대 3개
- severity 기준: "긴급"=즉시 병원, "주의"=1-2일 내 병원, "관찰"=경과 관찰 가능
- 추측이 아닌 수의학적 근거에 기반

[필드 작성 규칙 — 정확성·일관성 보장 필수]

▸ name_ko (한국어 질병명):
  - 한국 수의학 표준 용어 사용 (예: "고양이 특발성 방광염", "만성 신부전")
  - 한국어 표준 번역이 불확실하면 영문명 그대로 사용
    (잘못된 한국어 < 영문 — 예: 모르면 "Feline Idiopathic Cystitis" 그대로)
  - 영문 포함 X, 괄호 안 예시 X, 카테고리명 X (그건 다른 필드 담당)
  - 잘못된 예: "모래주머니염", "소화기 질환 (예: 위염)", "위염 (Gastritis)"
  - 올바른 예: "고양이 특발성 방광염", "위염", "Feline Idiopathic Cystitis"

▸ name_en (학술 영문명):
  - 정식 학명 사용 (예: "Feline Idiopathic Cystitis")
  - 약어가 임상에서 일반적이면 함께 (예: "Chronic Kidney Disease (CKD)")
  - 한국어 X (그건 name_ko)

▸ category (임상 분류, 옵셔널):
  - 신체 시스템 기준 분류만 (예: "비뇨기 질환", "소화기 질환", "내분비 질환")
  - 확실할 때만 포함, 애매하면 생략 (필드 자체 제외)
  - "고양이 질환" 같은 종 기준 분류 X

▸ description (보호자 친화 설명):
  - 의심 이유 + 일상 용어 (2-3문장)
  - 학술 표기 / 영문 X (그건 name_en)
  - 어려운 용어 처음 등장 시 풀어쓰기

[응급 신호 (emergency_signs) — 최대 3개]
- 구체적이고 측정 가능한 신호로 작성
  · 좋은 예: "분당 호흡수 40회 이상", "24시간 이상 식음 전폐", "잇몸이 보라색/회색"
  · 나쁜 예: "상태가 안 좋아 보일 때", "위급한 상황"
- 보호자가 즉시 알아볼 수 있는 표현 사용

[추가 질문 (followup_questions) — 최대 3개]
질문 설계 원칙 (감별진단에 결정적인 질문 우선):
- 의심 질병 후보들을 구분하는 데 결정적인 정보를 묻기
- 측정 가능한 정보 우선: 시작 시점, 빈도, 지속 시간, 유발 요인, 양상
- 양분되는 질문 우선: yes_no > select > text (text 는 정량화 어려운 경우만)
- "혹시 다른 증상도 있나요?" 같이 추상적이고 답하기 어려운 질문 회피
- 환자 컨텍스트가 제공된 경우:
  · 복용 약물의 부작용 가능성을 검증하는 질문 우선
  · 만성질환의 진행/악화 여부를 확인하는 질문 우선
  · 품종 호발 질병을 검증하는 질문 우선

type 사용 가이드:
- "yes_no": 양분되는 명확한 질문 (options 불필요, 클라이언트가 "예/아니오/모르겠어요" 자동 제공)
- "select": 2-5개 보기 중 하나 선택 (options 필수)
- "text": 정량적 정보가 필요한 경우만 (options 불필요)
- 질문 유형은 질문 내용에 맞게 적절히 선택해${isRefinement ? '\n- 이전에 했던 질문과 다른 새로운 질문을 해줘' : ''}`,
          },
          {
            role: 'user',
            content: `${patientLabel}가 이런 증상을 보입니다: "${sanitizeForLLM(symptoms)}"${petContextBlock}${followupContext}`,
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
    // 은 이걸 모르고 또 INSERT → 카운트 중복 차감. 최근 (user_id, kind, query,
    // pet_type) 로그가 있으면 INSERT 를 스킵해서 보호.
    //
    // dedup 키 선택:
    //  - pet_type 포함: 같은 증상을 강아지/고양이 양쪽으로 돌리는 의도적
    //    재검색이 deduped 되던 버그 수정.
    //  - symptom_refine 은 window 를 5초로 단축: 사용자가 답변을 바꿔서
    //    재분석 누르는 데 최소 15-30초 걸림 → 5초면 네트워크 재시도만 잡고
    //    의도적 재분석은 카운트 됨. query(=원증상)는 같지만 answer 는 다른
    //    refine 을 구분할 방법이 DB 컬럼에 없어 window 단축으로 우회.
    //  - symptom (최초 분석) 은 기존 60초 유지 — 같은 증상을 60초 안에 다시
    //    치는 건 거의 네트워크 재시도.
    const dedupWindowMs = isRefinement ? 5_000 : 60_000;
    const windowStart = new Date(Date.now() - dedupWindowMs).toISOString();
    const { data: recentDupe } = await supabaseAdmin
      .from('search_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('query', symptoms)
      .eq('pet_type', effectivePetType)
      .gte('created_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (!recentDupe) {
      await supabaseAdmin.from('search_logs').insert({
        user_id: userId,
        query: symptoms,
        pet_type: effectivePetType,
        kind,
      });
    }

    // 삽입 직후의 카운트를 응답에 포함 → 클라 배지 즉시 갱신.
    // 별도 GET /api/symptom-usage 없이도 race 없이 정확한 값 전달.
    // dedup 이 걸렸으면 count 그대로, 아니면 +1.
    const newUsed = recentDupe ? (count || 0) : (count || 0) + 1;

    // emergency_signs 정규화 — AI 가 옛 형식 (string[]) 으로 응답하는 케이스 대비.
    // 새 형식: { sign, severity, reason? } — UI 가 severity 별로 색 분기 가능.
    // 옛 응답 호환: 문자열은 { sign: 문자열, severity: '즉시' } 로 변환.
    const normalizedEmergencySigns = (parsed.emergency_signs ?? [])
      .slice(0, 3)
      .map((s: unknown) => {
        if (typeof s === 'string') return { sign: s, severity: '즉시' as const };
        if (s && typeof s === 'object' && 'sign' in s) {
          const obj = s as { sign?: string; severity?: string; reason?: string };
          const severity =
            obj.severity === '24시간내' || obj.severity === '경과관찰' ? obj.severity : '즉시';
          return {
            sign: String(obj.sign || ''),
            severity: severity as '즉시' | '24시간내' | '경과관찰',
            ...(obj.reason ? { reason: String(obj.reason) } : {}),
          };
        }
        return null;
      })
      .filter((s: { sign: string } | null): s is { sign: string; severity: '즉시' | '24시간내' | '경과관찰'; reason?: string } => s !== null && s.sign.length > 0);

    // diseases 후처리 — name_en 이 VET_TERM_MAP 에 있으면 한국어 강제 보정.
    // AI 의 잘못된 한국어 번역 (예: "모래주머니염") 을 표준 용어로 교체.
    // 사전에 없는 용어는 AI 응답 그대로 (프롬프트의 "영문 우선" 가이드 따라
    // 영문이 들어있을 수 있음 — 그대로 노출하는 게 잘못된 한국어보다 안전).
    const correctedDiseases = (parsed.diseases ?? []).slice(0, 3).map((d: any) => {
      const standardKo = lookupVetTerm(d?.name_en);
      return {
        ...d,
        ...(standardKo ? { name_ko: standardKo } : {}),
      };
    });

    const result = {
      diseases: correctedDiseases,
      followup_questions: (parsed.followup_questions ?? []).slice(0, 3),
      emergency_signs: normalizedEmergencySigns,
      // 펫 컨텍스트 사용 여부 + 펫 이름 — UI 에 "✨ 살구의 정보 반영" 배지 표시용.
      // 미사용/펫 없음 케이스에선 false / undefined 로 배지 안 뜸.
      context_used: petContext != null,
      pet_name: petContext?.pet.name,
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
