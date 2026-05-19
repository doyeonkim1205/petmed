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

/**
 * 사진 증상 분석 API — gpt-4o-mini Vision.
 *
 * 텍스트 증상 분석(/api/symptom-analysis)과 차이점:
 *  - Vision API 호출 (image_url + 선택적 보조 텍스트)
 *  - 1회성 — 사진 분석에는 재분석/follow-up 없음 (단순화)
 *  - kind = 'symptom_photo' 로 별도 일일 한도 (Plus 3회, Free 0회)
 *  - result_summary 메타 (input_type, main_category, ai_confidence, is_valid_photo) 저장
 *  - 분석 불가 케이스 (사진이 흐림 / 동물 아님 / 진단 부위 안 보임) 명시 처리
 *  - 서버단 2MB 페이로드 가드 (클라이언트 압축이 우회될 가능성 방어)
 *
 * 사진은 저장하지 않음 — 원본/리사이즈본 모두 분석 후 즉시 폐기.
 * 결과만 saved_analyses 로 사용자가 명시적으로 저장 가능 (별도 엔드포인트).
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    if (!checkRateLimit(`${userId}:symptom-photo`, 5, 60_000)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { imageDataUrl, hint, category, petType, petId } = await request.json();

    // 1) 입력 검증
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: '이미지 파일이 올바르지 않아요.' }, { status: 400 });
    }
    // 2MB 가드 — 클라이언트 압축을 우회한 직접 호출 차단
    const base64Body = imageDataUrl.split(',')[1] || '';
    const approxBytes = Math.floor((base64Body.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({
        error: '이미지가 너무 커요. 더 작은 사진을 사용해 주세요.',
      }, { status: 413 });
    }
    if (petType !== 'dog' && petType !== 'cat') {
      return NextResponse.json({ error: 'petType 이 올바르지 않아요.' }, { status: 400 });
    }
    type Category = 'skin' | 'eye' | 'wound' | 'dental' | 'ear' | 'other';
    const ALLOWED_CATEGORIES: readonly Category[] = ['skin', 'eye', 'wound', 'dental', 'ear', 'other'];
    const safeCategory: Category = ALLOWED_CATEGORIES.includes(category) ? category as Category : 'other';
    const safeHint = typeof hint === 'string' ? sanitizeForLLM(hint).slice(0, 300) : '';

    // 2) 펫 컨텍스트 (텍스트 분석과 동일하게 user_id 검증 포함)
    const petContext = petId ? await fetchPetContext(supabaseAdmin, userId, petId) : null;
    const petContextText = buildPetContextPrompt(petContext);
    const effectivePetType = petContext?.pet.type ?? petType;
    const effectivePetName = petContext?.pet.name;

    // 3) 플랜 + 일일 한도
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    const plan = getEffectivePlan(profile?.plan);
    const config = getPlanConfig(plan);

    // Free 유저는 평생 1회 체험, Plus 유저는 일일 한도 적용.
    if (plan === 'free') {
      if (config.photoAnalysisLifetimeFree === 0) {
        return NextResponse.json({
          error: '사진 증상 분석은 Plus 플랜에서만 사용할 수 있어요.',
          upgradeRequired: true,
        }, { status: 403 });
      }
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'symptom_photo');
      if ((count || 0) >= config.photoAnalysisLifetimeFree) {
        return NextResponse.json({
          error: '무료 체험(1회)을 모두 사용했어요. Plus 로 업그레이드하면 매일 3회 분석할 수 있어요.',
          limitReached: true,
          upgradeRequired: true,
        }, { status: 429 });
      }
    } else {
      const startOfDay = startOfDayKST();
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'symptom_photo')
        .gte('created_at', startOfDay.toISOString());
      if ((count || 0) >= config.photoAnalysisPerDay) {
        return NextResponse.json({
          error: `오늘의 사진 분석 횟수(${config.photoAnalysisPerDay}회)를 모두 사용했습니다.\n밤 12시(자정)에 초기화됩니다.`,
          limitReached: true,
        }, { status: 429 });
      }
    }

    const petLabel = effectivePetType === 'cat' ? '고양이' : '강아지';
    const patientLabel = effectivePetName ? `우리 ${effectivePetName}` : `우리 ${petLabel}`;
    const categoryLabel = (
      safeCategory === 'skin'   ? '피부'      :
      safeCategory === 'eye'    ? '눈'        :
      safeCategory === 'wound'  ? '외상'      :
      safeCategory === 'dental' ? '입·치아'   :
      safeCategory === 'ear'    ? '귀'        :
                                  '기타 부위'
    );

    const petContextBlock = petContextText
      ? `\n\n${petContextText}\n\n위 환자 정보를 반영하여 분석해줘.`
      : '';

    // 4) 시스템 프롬프트 — 텍스트 분석과 같은 윤리·균형 원칙 유지하되 사진 특화
    const systemPrompt = `당신은 한국 수의학 임상 경험 15년 이상의 보드 인증 수의사입니다.
보호자가 ${petLabel}의 사진을 보내왔습니다. 진료실에서 사진만 보고 판단할 때처럼 신중하게 분석하세요.

[책임감과 윤리 — 사진 분석의 한계 인식]
- 사진 한 장만으로 확진은 불가능합니다. 의심 후보 + 보호자 행동 가이드로 끝내세요.
- "사진 화질·각도가 분석에 충분한가" 를 먼저 판단하세요. 부족하면 솔직히 말하세요.
- 확실하지 않은 진단은 단정짓지 않습니다.
- 보호자가 이해할 수 있도록 쉽게 설명합니다.

[사진 적합성 판단 — 가장 먼저 수행]
다음 중 하나라도 해당하면 is_valid_photo = false 로 설정하고 invalid_reason 채우세요:
- 사진이 너무 흐리거나 어두워서 병변/부위가 식별 불가
- 사진에 ${petLabel}이 보이지 않음 (사람·풍경·다른 사물)
- 진단 대상 부위(${categoryLabel})가 사진에 없음
- 사진이 너무 작거나 멀어서 세부 식별 불가

is_valid_photo = false 이면 diseases / observations 는 빈 배열로 두고
invalid_reason 에 다시 찍을 때 팁(거리·조명·각도)을 한국어로 친절히 안내하세요.

[보조 텍스트 결합 — 가중치]
${safeHint
  ? `보호자가 보조 설명을 함께 보냈습니다: "${safeHint}"
- 사진(시각)과 보조 텍스트(맥락) 를 모두 고려하되, 진단 후보는 사진에서 보이는 것 우선.
- 보조 텍스트는 발현 시점·진행 속도·동반 증상 등 사진에 안 보이는 정보 해석에만 사용.
- 사진에 명확한 병변이 있는데 텍스트가 무관하면 사진을 우선합니다.`
  : `보호자는 별도 텍스트를 보내지 않았습니다. 사진만으로 객관적으로 관찰·분석하세요.`}

[심각한 가능성 숨기지 말 것 — 균형]
- 보호자 불안 조절도 중요하지만, 의심되는 심각한 질환을 의도적으로 빼지 마세요.
- 사진상 종양/궤양/심한 염증 의심 소견이 있으면 concern_level=medium 또는 high.

[감별진단 사고 — 구체적 진단명 출력 필수]
1. 사진에서 관찰되는 객관적 소견을 observations 배열에 먼저 정리 (색·형태·분포·크기 단서)
2. 그 소견에 부합하는 **구체적 감별진단** 을 0~3개 동등 고려.
   ⚠️ "피부염" / "안과 질환" / "치과 질환" 같은 generic 카테고리만 출력 금지.
   ⚠️ 시각적 소견에 부합하는 **여러 후보를 동등 weight 로** 나열하라.
3. 환자 컨텍스트(품종/나이/만성질환/약) 있으면 우선순위 조정.

[부위별 자주 보이는 구체 감별진단 — 참고 풀]
▸ 피부:
  - 피부사상균증 (ringworm / dermatophytosis) — 원형 탈모 + 인설
  - 모낭충증 (demodicosis) — 국소·전신 탈모
  - 농피증 (pyoderma) — 농포·딱지
  - 알레르기성 피부염 (atopic dermatitis) — 양측성 가려움
  - 호산구성 육아종 (eosinophilic granuloma, 고양이) — 융기 병변
  - 옴 (scabies) — 강한 가려움 + 딱지
▸ 눈:
  - 결막염 (conjunctivitis)
  - 각막궤양 (corneal ulcer)
  - 안검내반증 (entropion)
  - 백내장 (cataract)
  - 녹내장 (glaucoma) — 동공 확대 + 충혈
  - 제3안검 노출 (cherry eye)
▸ 귀:
  - 외이염 (otitis externa) — 세균/효모/진드기성
  - 귀 진드기 (otodectes cynotis)
  - 혈종 (aural hematoma)
▸ 입·치아:
  - 치주염 (periodontitis)
  - 치석 (dental calculus)
  - 구내염 (stomatitis, 고양이)
  - 치아 흡수성 병변 (FORL, 고양이)
▸ 외상:
  - 자상/열상 (laceration) — 봉합 필요 여부 평가
  - 찰과상 (abrasion)
  - 화상 (burn)
  - 깊은 상처 (deep wound) — 즉시 응급
▸ 일반:
  - 종괴 (mass / tumor) — 양성·악성 감별 필요
  - 부종 (edema)
  - 발적 (erythema)

위 풀에서 시각 소견에 맞는 구체 진단명을 골라 출력하라.
generic 카테고리로 후퇴하지 말 것.

[잘못된 사고 — 회피]
❌ "피부염" / "안과 질환" 같은 generic 카테고리만 출력
❌ "흔한 진단이라서" 끼우기
❌ 사진에 안 보이는 부위 진단 (보조 텍스트로 추측)
❌ 사진 화질이 나쁜데 무리한 진단 (그땐 is_valid_photo=false)

[자기 검증 체크리스트 — 응답 전 확인]
□ name_ko 가 "○○염" 같이 상위 카테고리인가? → 구체 진단명으로 교체
□ 동일 시각 소견에 부합하는 다른 감별진단을 누락하지 않았는가?
□ matching_symptoms 가 사진의 객관적 소견인가, 막연한 추정인가?

반드시 아래 JSON 형식으로만 응답해:
{
  "is_valid_photo": true | false,
  "invalid_reason": "false 일 때만 채움. 친절한 한국어 안내 + 다시 찍을 때 팁 1-2개",
  "main_category": "Dermatology" | "Ophthalmology" | "Wound" | "Dental" | "Behavioral" | "Other" | "Invalid",
  "ai_confidence": "low" | "medium" | "high",
  "observations": [
    "사진에서 객관적으로 관찰되는 소견 (예: '왼쪽 귀 안쪽에 적색 발진 약 1cm', '눈 흰자에 충혈')"
  ],
  "diseases": [
    {
      "name_ko": "한국어 표준 수의학 용어",
      "name_en": "학술 영문명",
      "category": "임상 분류 (예: '피부 질환', '안과 질환')",
      "likelihood": "높음" | "중간" | "낮음",
      "severity": "긴급" | "주의" | "관찰",
      "description": "이 진단이 의심되는 이유 (2-3문장)",
      "matching_symptoms": ["사진/텍스트에서 이 진단과 일치하는 단서"],
      "additional_symptoms": ["이 진단이라면 추가로 나타날 수 있는 증상"],
      "action": "보호자가 지금 해야 할 행동 (1-2문장)"
    }
  ],
  "emergency_signs": [
    {
      "sign": "구체적이고 측정 가능한 응급 신호",
      "severity": "즉시" | "24시간내",
      "reason": "왜 응급인지 1문장"
    }
  ],
  "concern_level": "low" | "medium" | "high",
  "reassurance": "low/medium 일 때만 채움. 안심 한두 문장",
  "watch_signs": ["low/medium 일 때 채움. 진료 고려 신호 2~3개"]
}

규칙:
- is_valid_photo=false 일 때 diseases / observations / emergency_signs 는 빈 배열
- diseases 는 0~3개. 강제로 3개 채우지 말 것.
- name_ko 가 불확실하면 영문명 그대로 사용 (잘못된 한국어 < 영문)
- ${patientLabel} 같이 환자 호칭을 자연스럽게 사용`;

    // 5) Vision 호출
    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } }
    > = [
      {
        type: 'text',
        text: `${categoryLabel} 사진을 분석해주세요.${
          safeHint ? `\n보호자 보조 설명: ${safeHint}` : ''
        }${petContextBlock}`,
      },
      {
        type: 'image_url',
        image_url: { url: imageDataUrl, detail: 'auto' },
      },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('OpenAI vision error:', res.status, errText);
      Sentry.captureMessage(`vision-api-${res.status}`, { level: 'error' });
      return NextResponse.json(
        { error: 'AI 분석 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 502 },
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      Sentry.captureMessage('vision-json-parse-fail', { level: 'error' });
      return NextResponse.json(
        { error: 'AI 응답 처리에 실패했어요. 다시 시도해 주세요.' },
        { status: 502 },
      );
    }

    // 6) name_ko 후처리 — 텍스트 분석과 동일하게 VET_TERM_MAP 적용
    if (Array.isArray(parsed.diseases)) {
      for (const d of parsed.diseases) {
        if (d?.name_en && typeof d.name_en === 'string') {
          const standardKo = lookupVetTerm(d.name_en);
          if (standardKo) d.name_ko = standardKo;
        }
      }
    }

    // 7) is_valid_photo 후처리 — false 인데 diseases 가 있으면 비우기
    if (parsed.is_valid_photo === false) {
      parsed.diseases = [];
      parsed.observations = [];
      parsed.emergency_signs = [];
    }

    // 8) concern_level / 안내 필드 기본값 보강
    if (!['low', 'medium', 'high'].includes(parsed.concern_level)) {
      parsed.concern_level = parsed.is_valid_photo === false ? 'low' : 'medium';
    }
    if (parsed.concern_level === 'low' || parsed.concern_level === 'medium') {
      if (!parsed.reassurance) {
        parsed.reassurance = parsed.is_valid_photo === false
          ? '사진을 다시 찍어서 분석해 보세요.'
          : '지금 당장 위급한 상황으로 보이진 않아요. 변화가 있는지 잘 지켜봐 주세요.';
      }
      if (!Array.isArray(parsed.watch_signs) || parsed.watch_signs.length === 0) {
        parsed.watch_signs = [
          '증상이 빠르게 나빠지거나 새 부위로 번질 때',
          '식욕·기력이 함께 떨어질 때',
        ];
      }
    }

    // 9) 사용량 기록 + 메타 저장 (dedup 5초 윈도우 — 비행기모드 재시도 방어)
    const dedupWindowMs = 5_000;
    const windowStart = new Date(Date.now() - dedupWindowMs).toISOString();
    const { data: recentDupe } = await supabaseAdmin
      .from('search_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'symptom_photo')
      .gte('created_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (!recentDupe) {
      const inputType = safeHint ? 'photo_with_text' : 'photo';
      await supabaseAdmin.from('search_logs').insert({
        user_id: userId,
        query: safeHint || `[사진 분석: ${categoryLabel}]`,
        pet_type: effectivePetType,
        kind: 'symptom_photo',
        result_summary: {
          input_type: inputType,
          main_category: typeof parsed.main_category === 'string' ? parsed.main_category : 'Other',
          ai_confidence: typeof parsed.ai_confidence === 'string' ? parsed.ai_confidence : 'medium',
          is_valid_photo: parsed.is_valid_photo !== false,
        },
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('symptom-analysis-image error:', err);
    Sentry.captureException(err);
    return NextResponse.json(
      { error: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
}
