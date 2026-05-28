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
        { error: '요청이 너무 많습니다 잠시 후 다시 시도해주세요' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { imageDataUrl, hint, category, petType, petId } = await request.json();

    // 1) 입력 검증
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: '이미지 파일이 올바르지 않아요' }, { status: 400 });
    }
    // 2MB 가드 — 클라이언트 압축을 우회한 직접 호출 차단
    const base64Body = imageDataUrl.split(',')[1] || '';
    const approxBytes = Math.floor((base64Body.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({
        error: '이미지가 너무 커요 더 작은 사진을 사용해 주세요',
      }, { status: 413 });
    }
    if (petType !== 'dog' && petType !== 'cat') {
      return NextResponse.json({ error: 'petType 이 올바르지 않아요' }, { status: 400 });
    }
    // excretion = 대소변·구토 (사용자 사용 빈도 ↑ 카테고리). '기타' 제거.
    type Category = 'skin' | 'eye' | 'wound' | 'dental' | 'ear' | 'excretion';
    const ALLOWED_CATEGORIES: readonly Category[] = ['skin', 'eye', 'wound', 'dental', 'ear', 'excretion'];
    // 무효 카테고리는 'skin' 으로 fallback (가장 흔한 케이스).
    const safeCategory: Category = ALLOWED_CATEGORIES.includes(category) ? category as Category : 'skin';
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
          error: '사진 증상 분석은 Plus 플랜에서만 사용할 수 있어요',
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
          error: '무료 체험(1회)을 모두 사용했어요 Plus 로 업그레이드하면 매일 3회 분석할 수 있어요',
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
          error: `오늘의 사진 분석 횟수(${config.photoAnalysisPerDay}회)를 모두 사용했습니다\n밤 12시(자정)에 초기화됩니다`,
          limitReached: true,
        }, { status: 429 });
      }
    }

    const petLabel = effectivePetType === 'cat' ? '고양이' : '강아지';
    const patientLabel = effectivePetName ? `우리 ${effectivePetName}` : `우리 ${petLabel}`;
    const categoryLabel = (
      safeCategory === 'skin'      ? '피부'        :
      safeCategory === 'eye'       ? '눈'          :
      safeCategory === 'wound'     ? '외상'        :
      safeCategory === 'dental'    ? '입·치아'     :
      safeCategory === 'ear'       ? '귀'          :
      safeCategory === 'excretion' ? '대소변·구토' :
                                     '피부'
    );

    const petContextBlock = petContextText
      ? `\n\n${petContextText}\n\n위 환자 정보를 반영하여 분석해줘.`
      : '';

    // 4) 시스템 프롬프트 — 비례 원칙 + few-shot 예시 + 분비물 풀.
    //    중복 가이드 통합으로 Lost in the Middle 효과 ↓.
    const systemPrompt = `당신은 한국 수의학 임상 경험 15년 이상의 보드 인증 수의사입니다.
${patientLabel}의 ${categoryLabel} 사진을 시각 단서 기반으로 객관적으로 분석하세요.

[핵심 원칙 — 시각 단서 → 진단의 비례]
사진에서 보이는 시각 단서의 강도에 비례하는 진단을 출력하라.
- 가벼운 단서 → 가벼운 진단 + low concern
- 명확한 중간 단서 → 일반 진단 + medium concern
- 명확한 심각 단서 → 구체 심각 진단 + high concern

⚠️ 모든 사진을 심각하게 보지 말 것 (과잉 진단 회피)
⚠️ 모든 사진을 가볍게 보지 말 것 (보수적 후퇴 회피)
⚠️ "결막염" / "외이염" / "피부염" 같은 generic 카테고리로 후퇴 X
   시각 단서가 명확하면 임상 명칭 (각막궤양, ringworm 등) 그대로 출력
⚠️ 우물쭈물한 결과 X — 가벼움/중간/심각 셋 중 단호히 선택
⚠️ 망설이면 한 단계 위 — 빠른 진료가 늦은 진료보다 안전

[사진 적합성]
borderline (약간 흐림/어두움/멈) → valid + ai_confidence=low.
is_valid_photo=false 는 정말 식별 불가능할 때만:
- 완전히 흐려서 부위 식별 불가
- ${petLabel} 이 전혀 안 보임 (사람/풍경/다른 사물)
- 진단 부위(${categoryLabel}) 가 사진에 전혀 없음
- 너무 작거나 멀어서 색깔조차 식별 안 됨

[ai_confidence vs 진단명 — 분리]
- ai_confidence=low : 화질·각도로 AI 의 확신 낮음
- 진단명 : 시각 단서 기반 임상 명칭 (confidence 무관, 약화 X)
- 즉 confidence 낮아도 "각막궤양" 을 "결막염" 으로 바꾸지 말 것

[보조 텍스트 결합]
${safeHint
  ? `보호자 보조 설명: "${safeHint}"
사진(시각) + 텍스트(맥락) 결합. 진단은 사진 우선, 텍스트는 시점/진행/동반증상 해석에만.`
  : `보조 텍스트 없음. 사진만으로 객관 분석.`}

[감별진단 가이드]
1. 시각 소견을 observations 에 객관 정리 (색·형태·분포·크기)
2. 그 소견에 부합하는 구체 진단을 0~3개 동등 후보로 (강제 3개 X)
3. 환자 컨텍스트 (품종/나이/만성질환/약) 우선순위 조정
4. "○○염" 1개로 끝내지 말 것. 시각 단서 부합하는 여러 후보 동등 고려

[부위별 진단 풀]

▸ 피부:
  - 피부사상균증 (ringworm) — 원형 탈모 + 인설
  - 모낭충증 (demodicosis) — 국소·전신 탈모
  - 농피증 (pyoderma) — 농포·딱지
  - 알레르기성 피부염 — 양측성 가려움
  - 호산구성 육아종 (고양이) — 융기 병변
  - 옴 (scabies) — 강한 가려움 + 딱지
  - 멜라노마 / 비만세포종 — 노령 + 새 결절 + 색 변화
  - 종괴 (lipoma 등) — 양성·악성 감별

▸ 눈:
  - 결막염 (conjunctivitis)
  - 각막궤양 (corneal ulcer) — 각막 흰점/회색점
  - 안검내반증 / 안검외반증
  - 백내장 / 녹내장 — 동공 확대 + 충혈
  - 제3안검 노출 (cherry eye)
  - 안검 외상 / 안검 종양

▸ 귀:
  - 외이염 (otitis externa)
  - 귀 진드기 (otodectes)
  - 혈종 (aural hematoma)
  - 외이도 농양

▸ 입·치아:
  - 치주염 / 치석
  - 구내염 (고양이)
  - FORL (고양이)
  - 구강 종양 (멜라노마, 편평상피암)

▸ 외상:
  - 자상/열상 (laceration) — 봉합 필요 여부
  - 찰과상 / 화상
  - 깊은 상처 — 즉시 응급

▸ 대소변·구토:
  [대변]
  - 검은 변 (멜레나) → 상부 위장관 출혈 (high)
  - 선홍 혈변 → 항문선/대장염/항문 열상 (medium)
  - 흰색 변 → 췌장 외분비 부전/담관 폐쇄 (high)
  - 점액 변 → 대장 자극/IBD (medium)
  - 설사 → 위장염/식이 변경 (medium)
  - 기생충 (회충/촌충 마디) → 구충 필요 (medium)
  [구토]
  - 헤어볼 (trichobezoar) → 사료+털 섞인 토 (특히 고양이 흔함, low)
  - 노란 거품 (담즙) → 담즙 역류성 위염 OR 공복+헤어볼 가능 (low/medium)
  - 흰 거품 (위산) → 공복성 위염 (low/medium)
  - 점액성 토 → 식도 자극, 위염 (low/medium)
  - 붉은 (선혈) → 위 출혈/식도 외상 (high)
  - 갈색 (커피찌꺼기) → 만성 위 출혈 (high)
  - 사료 소화 X → 빠른 통과/식도 문제 (low/medium)
  - 이물 보임 → 위 이물 (high · 응급)
  ⚠️ 노란 토 사진 = 담즙 단정 X — 헤어볼/공복 위염 동등 후보로
  [소변]
  - 붉은 (혈뇨) → FIC/요로결석/방광염 (medium/high)
  - 갈색 (헤모글로빈뇨) → 용혈/약물 (high)
  - 혼탁/결정 → 결정뇨/감염 (medium)

[concern_level 분류]

▸ high (빠른 진료) — 시간 지연 시 회복 불가/위험 큰 경우
  안과: 각막궤양, 녹내장, 안검 외상
  외상: 깊은 자상, 활동성 출혈, 봉합 필요
  피부: 광범위 농피증+발열, 종괴 의심 (노령+크기 증가), 멜라노마/비만세포종 의심
  입·치아: 심한 잇몸 출혈+종괴, 구강 종양
  귀: 외이도 농양+출혈, 혈종
  대소변·구토: 검은/흰색 변, 붉은/갈색 구토, 헤모글로빈뇨, 위 이물

▸ medium (관찰 필요) — 진행 가능하나 즉각 위험 낮음
  일반 외이염/결막염/알레르기성 피부염
  국소 농피증, 모낭충증, ringworm
  표재성 상처, 가벼운 부종
  치석·경증 치주염
  설사, 점액 변, 일반 혈변, 노란/흰 구토, 일반 혈뇨

▸ low (가벼운 일상) — 정상 변이/자가 호전 가능
  가벼운 발적, 일시적 자극
  정상 신체 변이 (점, 색소 침착)
  단발성 알레르기 (벌레 물림)
  일과성 위장 자극 (가벼운 토 1~2회)

[Few-shot 예시 — 분류 근거 명확화]

[Light 예시]
✓ "강아지 콧등 가벼운 색소 침착"
  근거: 크기·색 변화 없음 + 평탄 + 다른 증상 없음
  → "정상 범위 색소 변이" / low / 모니터링

✓ "공복 후 1회 노란 토"
  근거: 노란색=담즙 + 거품 + 일과성
  → "담즙 역류성 위염 (일과성)" / low / 모니터링

[Moderate 예시]
✓ "결막 충혈 + 눈물 (각막 결손 없음)"
  근거: 충혈 명확 + 각막 표면 매끄러움
  → "결막염 + 안과 자극" / medium

✓ "원형 탈모 + 가장자리 인설"
  근거: 원형 + 인설 = ringworm 전형
  → "피부사상균증(ringworm) + 모낭충증 + 알레르기성 피부염" 동등 후보 / medium

✓ "선홍색 혈변"
  근거: 선홍=하부 출혈 + 항문 부위 가능
  → "항문선 문제 + 대장염 + 항문 열상" 동등 후보 / medium

[Serious 예시]
✓ "각막에 흰/회색 점 + 충혈"
  근거: 각막 결손 의심 + 24시간 내 진료 임상 기준
  → "각막궤양 (corneal ulcer) + 각막 외상" / high

✓ "노령견 하안검 검은 결절 (1cm+)"
  근거: 노령 + 색소 + 크기
  → "멜라노마 의심 + 양성 종양 + 사마귀" 동등 후보 / high

✓ "검은색 변 (멜레나)"
  근거: 검은색=상부 위장관 출혈 → 위궤양/종양 가능
  → "상부 위장관 출혈 + 위궤양 + 위 종양 의심" / high

[잘못된 사고 — 회피]
❌ "결막염" / "피부염" 같은 generic 1개로 후퇴
❌ "흔한 진단이라서" 무리하게 끼움
❌ 사진에 안 보이는 부위 추측 진단

반드시 아래 JSON 형식으로만 응답해:
{
  "is_valid_photo": true | false,
  "invalid_reason": "false 일 때만 채움. 다시 찍을 때 팁 1-2개",
  "main_category": "Dermatology" | "Ophthalmology" | "Wound" | "Dental" | "Otology" | "GI/Excretion" | "Other" | "Invalid",
  "ai_confidence": "low" | "medium" | "high",
  "observations": ["사진의 객관적 소견 (예: '왼쪽 귀 안쪽 적색 발진 약 1cm')"],
  "diseases": [
    {
      "name_ko": "한국어 표준 수의학 용어 (구체 진단명)",
      "name_en": "학술 영문명",
      "likelihood": "높음" | "중간" | "낮음",
      "severity": "긴급" | "주의" | "관찰",
      "description": "이 질병이 무엇인지 간단 설명 (1문장) + 이 진단이 의심되는 이유 (1-2문장)",
      "matching_symptoms": ["사진/텍스트에서 일치 단서"],
      "additional_symptoms": ["함께 나타날 가능성"],
      "action": "보호자가 할 일 (1-2문장)"
    }
  ],
  "emergency_signs": [
    { "sign": "응급 신호 (측정 가능)", "severity": "즉시" | "24시간내", "reason": "이유" }
  ],
  "concern_level": "low" | "medium" | "high",
  "reassurance": "low/medium 일 때만 (HIGH 면 빈 문자열)",
  "watch_signs": ["low/medium 일 때 채움 (HIGH 면 빈 배열)"]
}

규칙:
- diseases 는 0~3개. 강제 3개 X
- is_valid_photo=false 면 diseases/observations/emergency_signs 빈 배열
- name_ko 불확실하면 영문 그대로
- description 은 "이게 무슨 병인지 + 왜 의심하는지" 두 정보 모두 포함
- ${patientLabel} 호칭 자연스럽게`;

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
        // detail 'high' — Vision API 가 이미지를 512×512 타일로 쪼개 자세히 분석.
        // image tokens ~85 → ~765 (9배) 증가하지만 미세 병변 식별률 큰 폭 ↑.
        // (각막 결손, 종괴 경계, 변/소변 색상 등 시각 단서 정확도 핵심)
        image_url: { url: imageDataUrl, detail: 'high' },
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
        // 텍스트 증상 분석 (route.ts) 과 동일 파라미터로 통일.
        // 1f968df 에서 temperature 0.1 + seed=1 도입했으나 결정론이 너무 강해
        // 보수적 진단 (결막염 등) 으로 수렴 → 각막궤양 같은 high 진단 누락.
        // 같은 사진 재분석 일관성은 시스템 프롬프트의 "borderline 무조건 valid"
        // + "흔들리지 말 것" 가이드로 충분히 방어 가능.
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
        { error: 'AI 분석 중 오류가 발생했어요 잠시 후 다시 시도해 주세요' },
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
        { error: 'AI 응답 처리에 실패했어요 다시 시도해 주세요' },
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
          ? '사진을 다시 찍어서 분석해 보세요'
          : '지금 당장 위급한 상황으로 보이진 않아요 변화가 있는지 잘 지켜봐 주세요';
      }
      if (!Array.isArray(parsed.watch_signs) || parsed.watch_signs.length === 0) {
        parsed.watch_signs = [
          '증상이 빠르게 나빠지거나 새 부위로 번질 때',
          '식욕·기력이 함께 떨어질 때',
        ];
      }
    }

    // 출혈(피) 안전 가드 — 이미지 색 판단은 프롬프트가 담당하되, hint 텍스트에
    // 출혈 언급이 있으면 백업으로 격상(절대 low 금지, 검은·타르=high). 텍스트 분석과 동일 기준.
    const bloodRe = /혈변|혈뇨|토혈|혈토|객혈|각혈|하혈|잠혈|출혈|코피|혈담|선홍|피똥|피\s*똥|핏덩|핏물|피설사|피\s*설사|피를?\s*토|피를?\s*흘|피가?\s*나|피가?\s*섞|피\s*섞|피가?\s*묻|피\s*묻|붉은\s*피|빨간\s*피/;
    const melenaRe = /흑변|흑색변|검은\s*변|검은색\s*변|타르|짜장|커피\s*찌꺼기|커피색/;
    if (melenaRe.test(safeHint)) {
      parsed.concern_level = 'high';
    } else if (bloodRe.test(safeHint) && parsed.concern_level === 'low') {
      parsed.concern_level = 'medium';
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
      // INSERT 실패 명시적 로깅 — 이전엔 silent fail 로 사용량 카운트 안 되는 버그 발생.
      // CHECK constraint 위반 / RLS / 컬럼 NULL 등 즉시 감지 위해 error check + Sentry 알림.
      const { error: insertError } = await supabaseAdmin.from('search_logs').insert({
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
      if (insertError) {
        console.error('search_logs INSERT failed:', insertError.message);
        Sentry.captureMessage(`search_logs-insert-fail: ${insertError.message}`, {
          level: 'error',
          extra: { userId, kind: 'symptom_photo' },
        });
      }
    }

    // 10) 응답에 갱신된 usage 포함 — 클라이언트 state stale 방지.
    //     별도 fetch 안 거치고 즉시 setUsage 가능 → 한도 소진 후 분석 버튼 즉시 disabled.
    let usageUsed = 0;
    let usageLimit = 0;
    let usageWindow: 'lifetime' | 'daily' = 'daily';
    if (plan === 'free') {
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'symptom_photo');
      usageUsed = count || 0;
      usageLimit = config.photoAnalysisLifetimeFree;
      usageWindow = 'lifetime';
    } else {
      const startOfDay = startOfDayKST();
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'symptom_photo')
        .gte('created_at', startOfDay.toISOString());
      usageUsed = count || 0;
      usageLimit = config.photoAnalysisPerDay;
      usageWindow = 'daily';
    }

    return NextResponse.json({
      ...parsed,
      usage: { used: usageUsed, limit: usageLimit, plan, window: usageWindow },
    });
  } catch (err) {
    console.error('symptom-analysis-image error:', err);
    Sentry.captureException(err);
    return NextResponse.json(
      { error: '서버 오류가 발생했어요 잠시 후 다시 시도해 주세요' },
      { status: 500 },
    );
  }
}
