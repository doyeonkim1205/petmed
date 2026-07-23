import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { sanitizeForLLM } from '@/lib/sanitize';
import { startOfDayInTz, startOfWindowInTz } from '@/lib/dailyBoundary';
import { checkRateLimit } from '@/lib/rateLimit';
import { fetchPetContext, buildPetContextPrompt } from '@/lib/petContext';
import { lookupVetTerm } from '@/lib/vetTerms';
import { matchRedFlagsDetailed } from '@/data/redFlags';
import { localeFromRequest } from '@/lib/aiLocale';
import { normalizeSeverity, normalizeLikelihood, normalizeEmergencySeverity } from '@/lib/enumNormalize';
import { BLOOD_RE, MELENA_RE } from '@/lib/bloodPatterns';
import { buildSymptomSystemPromptEn } from '@/lib/prompts/symptomPrompt';

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
    // 응답 언어 — NEXT_LOCALE 쿠키 직접 읽기 (클라 본문 변경 없음).
    const locale = localeFromRequest(request);
    const en = locale === 'en';

    // 분 단위 burst 방어. 일일 한도와 별개로 초단위 스팸 차단.
    // 10 req/min 은 정상 유저가 절대 넘을 수 없는 값. 매크로만 걸림.
    if (!checkRateLimit(`${userId}:symptom-analysis`, 10, 60_000)) {
      return NextResponse.json(
        { error: en ? 'Too many requests. Please try again shortly.' : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { symptoms, petType, petId, followupAnswers, previousQuestions } = await request.json();
    if (!symptoms) {
      return NextResponse.json({ error: 'Missing symptoms' }, { status: 400 });
    }

    const isRefinement = Array.isArray(followupAnswers) && followupAnswers.length > 0;
    // 누적된 이전 질문 전체 (여러 라운드 재분석 시 모두 포함).
    // 클라이언트가 askedQuestions 로 관리해 매 재분석마다 전체 리스트 전송.
    const allPreviousQuestions: string[] = Array.isArray(previousQuestions)
      ? previousQuestions.filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
      : [];

    // 펫 컨텍스트 fetch — petId 옵셔널. 다른 유저 petId 면 silent fail (null 반환).
    // 보안: fetchPetContext 가 user_id 검증 포함.
    const petContext = petId ? await fetchPetContext(supabaseAdmin, userId, petId) : null;
    // 맞춤 분석(펫 의료정보 반영)은 Plus 전용 — plan 확정 후 무료면 컨텍스트를 비운다(아래).
    let petContextText = buildPetContextPrompt(petContext, locale);
    // species(강아지/고양이)는 게이팅하지 않음 — 무료도 정확한 종별 분석을 받는다.
    // (클라이언트가 petType 따로 보내도 펫 정보가 우선)
    const effectivePetType = petContext?.pet.type ?? petType;
    let effectivePetName = petContext?.pet.name;

    // Get user plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, quota_timezone')
      .eq('id', userId)
      .single();
    const plan = getEffectivePlan(profile?.plan);
    const config = getPlanConfig(plan);

    // ── 맞춤 분석 게이팅 (Plus 전용) ──
    // 무료는 펫 의료정보(이름·나이·체중·품종·만성질환·기록)를 반영하지 않는 '일반 분석'.
    // 종(effectivePetType)은 위에서 이미 확정 — 게이팅하지 않아 무료도 종별 정확도 유지.
    const usePetContext = plan === 'plus';
    if (!usePetContext) {
      petContextText = '';
      effectivePetName = undefined;
    }

    // Plan-based character limit
    if (symptoms.length > config.maxSymptomLength) {
      return NextResponse.json({
        error: en
          ? `Symptom input can be up to ${config.maxSymptomLength} characters.${plan === 'free' ? ' Upgrade to enter up to 500 characters.' : ''}`
          : `증상 입력은 최대 ${config.maxSymptomLength}자까지 가능합니다.${plan === 'free' ? ' 업그레이드하면 500자까지 입력할 수 있어요.' : ''}`,
      }, { status: 400 });
    }

    // Rate limit check
    // 증상분석은 plan 의 limitWindow(무료=월/Plus=일), 재분석은 항상 일일.
    const kind = isRefinement ? 'symptom_refine' : 'symptom';
    const useMonthly = !isRefinement && config.limitWindow === 'month';
    const quotaTz = profile?.quota_timezone || 'Asia/Seoul';
    const since = isRefinement ? startOfDayInTz(quotaTz) : startOfWindowInTz(config.limitWindow, quotaTz);
    const limit = isRefinement ? config.symptomRefinePerDay : config.symptomSearchPerDay;

    const { count } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind)
      .gte('created_at', since.toISOString());

    if ((count || 0) >= limit) {
      // `\n` 기준 두 줄 구성 — 클라이언트가 split 해서 둘째 줄은 작게 렌더.
      let errorMsg: string;
      if (en) {
        const label = isRefinement ? 're-analyses' : 'symptom analyses';
        const period = useMonthly ? "this month's" : "today's";
        const reset = useMonthly ? 'It resets on the 1st of next month.' : 'It resets at midnight (12 AM).';
        errorMsg = `You've used all of ${period} ${label} (${limit}).\n${reset}`;
      } else {
        const label = isRefinement ? '재분석' : '증상 분석';
        const period = useMonthly ? '이번 달' : '오늘';
        const reset = useMonthly ? '다음 달 1일에 초기화됩니다.' : '밤 12시(자정)에 초기화됩니다.';
        errorMsg = `${period}의 ${label} 횟수(${limit}회)를 모두 사용했습니다.\n${reset}`;
      }
      return NextResponse.json({ error: errorMsg, limitReached: true }, { status: 429 });
    }

    const petLabel = effectivePetType === 'cat' ? '고양이' : '강아지';
    // 환자 호칭 — 펫 컨텍스트 있으면 이름 사용 ("우리 살구가"), 없으면 종 ("우리 강아지가")
    const patientLabel = en
      ? (effectivePetName ? `our ${effectivePetName}` : `our ${effectivePetType === 'cat' ? 'cat' : 'dog'}`)
      : (effectivePetName ? `우리 ${effectivePetName}` : `우리 ${petLabel}`);

    // Build follow-up context for refined analysis.
    // blocked 질문 = (1) 클라이언트가 누적한 모든 이전 질문 + (2) 이번 답변의 질문.
    // (1) 이 핵심 — 여러 라운드 재분석 시 1라운드 질문까지 모두 포함돼 진정한
    // 중복 방지 가능. 클라가 안 보내도 fallback 으로 (2) 동작 (옛 클라 호환).
    let followupContext = '';
    if (isRefinement) {
      const answersText = followupAnswers
        .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n');
      const fallbackPrev = followupAnswers
        .map((a: { question: string }) => a.question)
        .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0);
      // 누적 리스트가 있으면 우선, 없으면 현재 답변의 질문만 (백워드 호환).
      // Set 으로 중복 제거 후 명령형 가이드 함께 전달.
      const blockedQuestions = Array.from(new Set(
        allPreviousQuestions.length > 0 ? allPreviousQuestions : fallbackPrev
      ));
      const blockedQuestionsText = blockedQuestions.length > 0
        ? (en
            ? `\n\n[⚠️ Already-asked questions — never ask these again]\n${blockedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n→ Do not generate questions identical or similar in meaning to the above. Only generate questions asking genuinely new clinical information.`
            : `\n\n[⚠️ 이미 물어본 질문 — 절대 다시 묻지 말 것]\n${blockedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n→ 위 질문과 같거나 의미가 유사한 질문 생성 금지. 정말 새로운 임상 정보를 묻는 질문만 생성.`)
        : '';
      followupContext = en
        ? `\n\nThe guardian answered the follow-up questions:\n${answersText}${blockedQuestionsText}\n\nReflect this additional information for a more accurate analysis. Provide a new analysis that completely replaces the previous one.`
        : `\n\n보호자가 추가 질문에 답변했습니다:\n${answersText}${blockedQuestionsText}\n\n이 추가 정보를 반영하여 더 정확하게 분석해줘. 이전 분석을 완전히 대체하는 새로운 분석을 제공해.`;
    }

    // 펫 컨텍스트 안내 블록 — 환자 정보가 있으면 user message 에 [환자 정보] 섹션
    // 형태로 주입. NULL 필드는 buildPetContextPrompt 에서 자동 생략됨.
    const petContextBlock = petContextText
      ? (en
          ? `\n\n${petContextText}\n\nReflect the patient information above in your analysis:
- Prioritize breed-predisposed diseases
- Check links with chronic conditions
- Consider possible side effects of current medications
- Recommend avoiding allergens/contraindicated drugs`
          : `\n\n${petContextText}\n\n위 환자 정보를 반영하여 분석해줘:
- 품종 호발 질병 우선 고려
- 만성질환과의 연관성 검토
- 복용 약물 부작용 가능성 검토
- 알레르기/금기 약물 회피 권고`)
      : '';

    // ── 레드플래그(치명적 감염성 질환) 주입 ──
    // 입력 증상이 매칭될 때만 짧은 힌트를 user message 에 주입. prose 규칙이 긴
    // 프롬프트에 묻혀 누락되던 파보·디스템퍼·범백·FIP·광견병·고양이 안과 감염을
    // "반드시 감별 후보 포함"으로 강제. 매칭 안 되면 빈 문자열(프롬프트 비대화 X).
    // 레드플래그 — locale 별 힌트 + concern 하한(후처리 보정용)을 함께 받음.
    const redFlagMatches = matchRedFlagsDetailed(effectivePetType, symptoms, locale);
    const redFlagBlock = redFlagMatches.length > 0
      ? (en
          ? `\n\n[Key diseases that MUST be included as differential candidates for these symptoms — do not omit]\n${redFlagMatches.map((m) => `- ${m.hint}`).join('\n')}\n→ Include the above in the diseases array, and state in action/description that "confirmation requires veterinary testing." (Symptom-based, so presenting them as differentials is appropriate.)`
          : `\n\n[이 증상에서 반드시 감별 후보에 포함할 주요 질환 — 누락 금지]\n${redFlagMatches.map((m) => `- ${m.hint}`).join('\n')}\n→ 위 질환을 diseases 배열에 반드시 포함하되, action/설명에 "확진은 병원 검사 필요"를 명시하라. (사진이 아닌 증상 기반이므로 감별로 제시하는 것은 적절)`)
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
        // 응답 길이 cap — 타임아웃 + 비용 안정화. JSON 구조에 1500 토큰이면
        // diseases 3개 + followup 2개 + emergency_signs 2~3개 모두 여유.
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: en
              ? buildSymptomSystemPromptEn(effectivePetType, isRefinement)
              : `당신은 한국 수의학 임상 경험 15년 이상의 보드 인증 수의사입니다.
${petLabel} 보호자가 설명한 증상을 진료실에서처럼 신중하게 분석합니다.

[책임감과 윤리 — 분석의 기본 자세]
- 보호자는 당신의 분석을 믿고 진료 여부·시점을 결정합니다.
- 잘못된 진단은 치료 지연 / 과잉 진료 / 신뢰 손상으로 이어집니다.
- "확실하지 않을 때 단정짓지 않는 용기" 가 정확한 진단보다 더 중요합니다.
- 일상적·정상 행동 가능성도 솔직히 평가하세요. 모든 증상을 병으로 몰지 않습니다.
- 보호자가 이해할 수 있도록 쉽게 설명합니다.

[심각한 가능성 숨기지 말 것 — 핵심 균형]
보호자 불안 조절이 중요하지만, **심각한 질환을 의도적으로 누락하는 것은 더 큰 위험**.
- "흔한 양성 질환" 만 출력하지 말 것. 임상적으로 가능한 심각한 질환도 동등 고려.
- 노령 환자 (8살+) 의 만성·지속 증상은 종양·자가면역 가능성 절대 배제 X
- 검사 소견 (X-ray·초음파·혈액검사) 이 언급되면 그 소견에 부합하는 진단 모두 고려
  · 예시: "위벽 비후" → 위염 (양성) + 림포마 (악성) + IBD 모두 후보
  · 예시: "신장 수치 상승" → 신부전 + 신독성 약물 + 종양 모두 후보
- "안심 메시지(concern_level=low)" 는 **정말 가벼운 일상 증상** 한정.
  임상 소견이 있거나 노령 환자의 진행성 증상이면 concern_level=medium 또는 high.
- 보호자를 안심시키려고 심각한 가능성을 빼지 말 것. 정확한 정보 제공이 더 친절한 일.

[감별진단(differential diagnosis) 사고 방법론]
1. 증상이 가리키는 신체 시스템 정확히 파악
   (소화기 / 비뇨기 / 근골격계 / 피부 / 호흡기 / 신경계 / 행동학 / 내분비 / 안과 등)
2. 그 시스템 내 여러 가능성 동등하게 고려 — 가장 흔한 1개로 단정 X
3. 시스템과 무관한 질환은 절대 후보로 넣지 않음 (가장 중요)
   ⚠️ 예외 — "비특이적 전신 증상" 은 여러 시스템이 모두 관련 시스템 (바로 아래 참조)
4. 환자 컨텍스트 (품종·나이·만성질환·복용약) 가 있으면 우선순위 조정
5. 응답 전 자기 검증 (아래 체크리스트 통과해야 출력)

[비특이적 전신 증상 — 다중 시스템 감별 (중요)]
구토 · 식욕부진(물·음식 거부) · 무기력 · 체중 감소 · 발열 · (혈변 아닌) 설사 처럼
특정 부위가 아니라 전신 상태를 반영하는 증상은 "단일 시스템" 규칙의 예외입니다.
- 이때는 소화기 + 신장 + 간 + 내분비 등 여러 시스템의 감별진단을 동등하게 제시할 것.
  한 시스템만 골라 1개로 단정 금지 (실제 수의사도 이런 증상은 여러 장기를 동시에 의심).
- 예: "구토 + 물·음식 거부"
  → 위장염·췌장염·이물질/장폐색(소화기) + 급성/만성 신부전(신장) + 간질환 + 당뇨·애디슨(내분비)
     중 가능성 높은 2~4개를 동등 후보로. concern_level=medium 이상.
- 단, "방구·절뚝·가려움·눈곱" 처럼 명백히 한 부위를 가리키는 국소 증상은
  기존 단일 시스템 규칙 그대로 (전신 증상 예외 아님).

[복합 증상 기반 다각도 감별 가이드 (Differential Diagnosis)]
특정 장기나 시스템(예: 내분비계, 비뇨기계)의 호르몬/대사 이상으로 인해
다음·다뇨, 체중 변화, 피부 증상이 복합적으로 나타나는 경우, 단일 질환으로
성급하게 축소하지 말고 아래의 주요 감별 질환들을 **독립 후보군**으로 다각도
고려할 것. (단, 증상과 연관성이 없는 타 계통 질환을 억지로 끼워 넣는 행위는 금지)

▸ 패턴 A (다음 + 다뇨 + 탈모 + 배 처짐/헐떡임):
  쿠싱(Cushing) · 당뇨(DM) · 요붕증 등 대사성 후보군을 다각도 고려.

▸ 패턴 B (식욕↑ + 체중↓ + 활동성↑ — 주로 노령묘):
  갑상선 기능항진증 · 당뇨 등을 다각도 고려.

▸ 패턴 C (만성 다음 + 체중↓ + 식욕↓):
  만성 신부전(CKD) · 갑상선 기능 이상 등을 다각도 고려.

⚠️ 각 질환의 고유 위험도에 따른 concern_level 및 severity 는 **독립적으로 산정**.
   질환을 나열한다고 해서 위험도를 인위적으로 낮추지 말 것.
   (예: 패턴 A 에서 DKA 동반 가능성이 있으면 그 자체로 high — 쿠싱과 평균 X)

[자기 검증 체크리스트 — 각 disease 마다 응답 전 확인]
□ 입력 증상의 시스템과 이 disease 의 시스템이 일치하는가?
   ⚠️ 불일치면 그 disease 제외 (예: "방구"는 소화기, FIC는 비뇨기 → 제외)
   ※ 단, 비특이적 전신 증상(구토·식욕부진·무기력 등)이면 여러 시스템 모두 "일치" 로 본다.
□ matching_symptoms 가 입력 증상의 직접 표현인가, 억지 추상화인가?
   ⚠️ 추상화면 제외 (예: "방구" → "배변 이상" 으로 추상화한 비뇨기 매칭 X)
□ "흔한 진단이라서" / "3개 채우려고" 끼운 건가?
   ⚠️ 그렇다면 제외. 1~2개여도 정확한 게 낫다. 0개도 OK.

[잘못된 진료 사고 — 절대 회피]
❌ "고양이라 FIC 일단 끼우자" — anchoring bias
❌ "강아지 절뚝거림은 슬개골 탈구 단일 진단" — 감별진단 무시
❌ "3개 채워야 하니 약한 후보도 넣자" — 추측은 진단이 아님
❌ "방구 = 배변 이상 = 비뇨기" — 단어 추상화로 시스템 점프

[올바른 진료 사고 예시]
✓ "방구를 껴요" → 위장 가스 (소화기) 1개. concern_level=low.
✓ "절뚝거려요" → 슬개골 탈구 (정형) + 근육 좌상 (외상) + 발바닥 상처 (피부)
   같은 시스템(정형)만 채우지 말고 다른 카테고리도 동등 고려.
✓ "똥을 여기저기 싸요" → 변비 (소화기) + 항문선 문제 + 행동학적 (스트레스)
   "똥"=대변, 비뇨기 질환 (FIC 등) 절대 X.
✓ "오줌을 자주 봐요" → FIC + 요로결석 (둘 다 비뇨기, 시스템 일치)
   이때는 비뇨기 질환이 정답.
✓ "초음파상 위벽이 두꺼워요" → 만성 위염 (양성) + 소화기 림포마 (악성) + IBD
   임상 소견 있고 노령묘면 양성·악성 모두 동등 고려. 위염만 출력 X.
   concern_level=medium 또는 high (검사 소견 = 일상 증상 아님).

[배변 vs 배뇨 — 절대 혼동 금지 — 가장 자주 발생하는 오류]
한국어는 배변(대변)과 배뇨(소변)를 단어로 명확히 구분합니다.
영어의 "house soiling" / "elimination" / "litter box avoidance" 같은
모호한 개념으로 추상화해서 시스템을 점프하지 마세요.

▸ 입력에 "똥 / 대변 / 변 / 설사 / 변비" 만 있고 "오줌 / 소변 / 뇨" 없으면:
  ⚠️ 비뇨기 질환 (FIC, 요로결석, 방광염 등) 후보 절대 X
  → 소화기 (변비/설사/IBD/항문선) + 행동학 (스트레스/영역) 만 고려
  → "화장실 외 배변" = 화장실 환경 불만 / 변비 통증 / 스트레스 등

▸ 입력에 "오줌 / 소변 / 뇨 / 배뇨" 있으면:
  → 비뇨기 질환 우선 고려 (FIC, 요로결석 등 정답 가능)

▸ 입력에 "방귀 / 방구 / 가스 / 트림" 만 있으면:
  → 소화기 (가스) 만. 비뇨기 절대 X.
  → 일상적 생리 현상일 가능성 큼 (low concern_level)

[증상-시스템 매핑 — 추론 참조용 (키워드 매칭 X, 의미 매칭)]
- 소화기:    구토·설사·변비·식욕·똥·대변·방귀·가스·트림
- 비뇨기:    소변·오줌·뇨·방광·배뇨 통증·다음·다뇨
- 근골격계:  절뚝·다리·걷기·뛰기·관절·뼈·부종·움직임 이상
- 피부:      가려움·털 빠짐·발진·딱지·부스럼·빨개짐
- 호흡기:    기침·호흡·재채기·콧물·헐떡임·호흡곤란
- 신경계:    발작·의식 저하·균형 못 잡음·머리 기울임·마비
- 행동학:    화장실 회피·우는 횟수 변화·공격성·숨음·활동성 감소
- 내분비:    다음·다뇨·다식·체중 변화·털 빠짐 패턴·무기력
- 안과:      눈물·눈곱·충혈·눈 비비기·동공 변화

⚠️ 위 단어를 단순 매칭하지 말고, 입력 증상의 "의미" 가 어떤 시스템을
가리키는지 임상적으로 추론하세요. 한국어 단어가 명확한데 영어 개념으로
추상화해서 시스템 점프하지 마세요 (대표 사례: 배변 → "house soiling" → 비뇨기 ❌).

[소견(finding) vs 원인(etiology) — 감별진단에 원인 질환 포함]
"결막염 · 피부염 · 위장염" 같은 건 소견(증상 묶음)일 뿐 원인이 아닐 때가 많다.
같은 시스템 안에서 그 소견을 일으키는 흔한 원인 질환 — 특히 종(種) 특이 감염성 원인 — 도 감별에 포함할 것.
- 고양이 눈물·눈곱·결막염 → 허피스바이러스(FHV-1) · 칼리시바이러스 · 클라미디아 · 마이코플라스마
  (고양이 결막염의 가장 흔한 원인은 감염성. "결막염" 단독 출력 X — 원인 후보를 함께 제시)
- 고양이 각막 손상·궤양 → 허피스바이러스가 흔한 원인 중 하나
- 강아지 눈물·눈곱 → 건성각결막염(KCS) · 알레르기 · 세균/바이러스 감염 · 안검 이상
즉 "소견명 1개"가 아니라 "소견 + 그 흔한 원인 질환들" 을 동등하게 제시하라.

이 모든 원칙을 따라 분석하세요.

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
  ],
  "concern_level": "low" | "medium" | "high",
  "reassurance": "concern_level 이 low/medium 일 때만 채움. 보호자에게 안심을 주는 한국어 한두 문장 (정상 가능성 언급 등)",
  "watch_signs": ["concern_level 이 low/medium 일 때 채움. '이런 경우엔 진료를 고려하세요' 신호 2~3개"]
}

규칙:
- diseases 는 0~3개. 강제로 3개 채우지 말 것.
  · matching_symptoms 가 명확히 1개 이상일 때만 포함
  · 추측·억지 매칭·연관 약한 질환 끼워넣기 금지
  · 정상 행동일 가능성이 더 크면 빈 배열도 OK
  · concern_level 별 권장 개수:
      - low    : 0~1개 (대부분 비워두는 게 정상)
      - medium : 1~3개
      - high   : 1~3개 (응급 가능성 강조)
  · "방구를 껴요" 같이 일상적·가벼운 증상엔 무리한 질병 매칭 금지
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

[concern_level — 보호자 불안 조절을 위한 핵심 평가]
정상 행동 가능성을 솔직하게 평가해. 모든 증상을 "병"으로 몰지 말 것.
**low 선택을 망설이지 말 것** — watch_signs 가 진료 권장 신호를 별도로 안내하므로,
"low 라고 했는데 응급이면 어떡하지" 같은 우려는 watch_signs + emergency_signs 로 보호됨.

- "low" (정상 행동 가능성 큼) — **가벼운 일상 증상에 한정**:
  · 가끔 토함 (헤어볼·풀 섭취 등 흔한 원인 가능)
  · 일상 그루밍 / 가려움 / 졸음 증가
  · 단발성·일시적 / 산발적 증상 한두 개만
  · 활동성·식욕은 정상
  · 방구·트림·하품·코골이 같은 명백한 생리 현상
  · ⚠️ 다음 케이스는 low 아님 (medium/high 로):
    - 검사 소견 언급 (X-ray, 초음파, 혈액검사 등)
    - 노령 환자 (8살+) 의 만성·지속 증상
    - 체중 감소·식욕 부진이 며칠 이상 지속
    - "위벽 비후", "결절", "부종" 같은 의학 소견

- "medium" (지켜볼 필요 있음):
  · 며칠 이상 명확히 지속되는 증상
  · 평소와 분명히 다른 행동
  · 가능성 있는 질환이지만 응급은 아님

- "high" (적극 진료 권장):
  · 응급 신호 동반 (호흡곤란·발작·다량 출혈·의식 저하 등)
  · 만성질환 환자의 명백한 악화 징후
  · 다발성·복합 증상

[출혈(피) 증상 — 안전 규칙 · 매우 중요]
- 토혈·혈변·혈뇨·각혈 등 "피"가 언급되면 **절대 concern_level=low 금지** (최소 medium).
- 변/토물의 색·양상으로 출혈 위치를 구분해 description 에 설명할 것:
  · 선홍색(밝은 빨강) 혈변 = 하부 위장관·직장·항문 (가벼운 자극일 수도, 파보·출혈성 장염 등 응급일 수도)
  · 검은색·타르색 변(melena), 커피찌꺼기색 토물 = 소화된 피 = 상부 위장관 출혈 → concern_level=high
- 선홍색 소량 + 그 외 정상 = medium (단, "정상" 단정 금지 + 강한 진료 권장, watch_signs 에 응급 전환 신호 포함)
- 선홍색이라도 다량·하루 이상 지속·무기력·구토·식욕부진·어린/노령 동반 = high
- 색·양상이 불명확하면 followup_questions 로 "변(또는 토물) 색이 선홍색인가요, 검은 타르 같은가요?" 를 반드시 물을 것

[reassurance — concern_level 이 low/medium 일 때만 필수]
- 한국어 1~2문장
- low: "정상 행동일 가능성도 있다" / "너무 걱정하지 마세요" 류 안심 톤
- medium: "정상 행동/정상 가능성"으로 운을 떼지 말 것. 차분하되 관찰이 필요하다는 톤으로 바로 안내.
  (예: "아직 응급 상황은 아니지만 지켜볼 필요가 있어요. 증상이 지속되면 진료를 고려하세요.")
- high 일 땐 reassurance 생략 (빈 문자열 가능)
- 펫 이름이 환자 정보에 있으면 자연스럽게 사용 가능

[watch_signs — concern_level 이 low/medium 일 때 필수]
- "이런 경우엔 진료를 고려하세요" 신호 2~3개
- 구체적·측정 가능한 표현 (예: "1주일 이상 지속될 때", "다른 증상이 추가될 때")

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

[질문 중복 방지 — 한 응답 안에서도 중요]
- 한 응답 안의 3개 질문은 서로 다른 임상 정보를 물어야 함
- 같은 측면을 다른 표현으로 두 번 묻지 말 것
  · ❌ Q1: "기침이 마른가요?" / Q2: "기침 양상은?" — 거의 같은 질문
  · ✓ Q1: "기침이 마른가요?" / Q2: "밤에 더 심한가요?" — 다른 측면
- 정보 가치 낮은 질문은 차라리 생성하지 말 것 (3개 채우려고 중복 X)

type 사용 가이드:
- "yes_no": 양분되는 명확한 질문 (options 불필요, 클라이언트가 "예/아니오/모르겠어요" 자동 제공)
- "select": 2-5개 보기 중 하나 선택 (options 필수)
- "text": 정량적 정보가 필요한 경우만 (options 불필요)
- 질문 유형은 질문 내용에 맞게 적절히 선택해${isRefinement ? '\n- 이전에 했던 질문과 다른 새로운 질문을 해줘' : ''}`,
          },
          {
            role: 'user',
            content: en
              ? `${patientLabel} is showing these symptoms: "${sanitizeForLLM(symptoms)}"${redFlagBlock}${petContextBlock}${followupContext}`
              : `${patientLabel}가 이런 증상을 보입니다: "${sanitizeForLLM(symptoms)}"${redFlagBlock}${petContextBlock}${followupContext}`,
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
        // 관찰 모드(차단 X) — 기기/플랫폼/펫등록여부/입력길이. 어뷰징·테스트성 패턴 사후 분석용.
        result_summary: {
          device_id: request.headers.get('x-device-id') || null,
          platform: request.headers.get('x-platform') || null,
          has_pet: !!petContext,
          text_length: typeof symptoms === 'string' ? symptoms.length : null,
        },
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
          // EN/KO 어느 쪽 enum 이든 KO canonical 로 흡수 (영어 모드는 'Now'/'Within 24h' 등).
          return {
            sign: String(obj.sign || ''),
            severity: normalizeEmergencySeverity(obj.severity),
            ...(obj.reason ? { reason: String(obj.reason) } : {}),
          };
        }
        return null;
      })
      .filter((s: { sign: string } | null): s is { sign: string; severity: '즉시' | '24시간내' | '경과관찰'; reason?: string } => s !== null && s.sign.length > 0);

    // diseases 후처리:
    //  1. name_en 이 VET_TERM_MAP 에 있으면 한국어 강제 보정 (모래주머니염 → 고양이 특발성 방광염)
    //  2. matching_symptoms 가 비어있는 disease 제외 — AI 가 무리하게 끼워넣은
    //     무관한 질환 거름 ("방구" → 고양이 특발성 방광염 같은 부적절 매칭 방어)
    //  3. 최대 3개 cap
    const rawDiseases = (parsed.diseases ?? []) as any[];
    const correctedDiseases = rawDiseases
      .filter(d => {
        // matching_symptoms 빈약하면 AI 가 억지로 끼운 케이스 → 제외
        if (!d) return false;
        const matches = Array.isArray(d.matching_symptoms) ? d.matching_symptoms : [];
        const validMatches = matches.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0);
        if (validMatches.length === 0) return false;
        return true;
      })
      .map((d: any) => {
        // vetTerms KO 보정은 한국어 출력일 때만 — EN 은 모델이 준 영어 name_ko 유지(기준 8).
        const standardKo = en ? null : lookupVetTerm(d?.name_en);
        // severity / likelihood 정규화 — EN/KO enum 모두 KO canonical 로 흡수 + 누락 시 안전 기본값.
        // (전체 긴급도는 concern_level 박스 담당이라 보조 뱃지는 과경고하지 않음 → 기본 관찰/낮음)
        const severity = normalizeSeverity(d?.severity);
        const likelihood = normalizeLikelihood(d?.likelihood);
        return {
          ...d,
          ...(standardKo ? { name_ko: standardKo } : {}),
          severity,
          likelihood,
        };
      })
      .slice(0, 3);

    // concern_level 정규화 — AI 가 다른 값 보내거나 누락 시 'medium' 으로 fallback.
    // medium = 기존 UI (가장 안전한 기본값 — 톤 조절 없이 disease cards 표시).
    const rawConcern = parsed.concern_level;
    let concernLevel: 'low' | 'medium' | 'high' =
      rawConcern === 'low' || rawConcern === 'high' ? rawConcern : 'medium';

    // diseases 가 0개로 필터링됐는데 concern_level 이 high 가 아니면 → low 로 강제.
    // (AI 가 medium 으로 두고 disease 만 끼웠다가 후처리에서 다 거른 케이스 보호)
    if (correctedDiseases.length === 0 && concernLevel !== 'high') {
      concernLevel = 'low';
    }

    // ── 출혈(피) 증상 안전 가드 (최종 안전망) ──
    // LLM 이 규칙을 어기고 출혈을 low 로 깔아도 여기서 강제 격상한다.
    //   · melena(검은·타르변)·커피찌꺼기 토물 = 상부 위장관 출혈 → high
    //   · 그 외 출혈(선홍 등) = 최소 medium (절대 low 금지)
    // "피"·"혈" 단독은 오탐(피부/피곤/빈혈/혈압)이 많아 제외하고, 출혈을 뜻하는 복합어/영어 토큰만 매칭.
    // 공유 패턴(bloodPatterns)으로 KO+EN 동시 감지 — 영어 입력도 안전망 동작.
    const bloodDetected = BLOOD_RE.test(symptoms);
    const melenaDetected = MELENA_RE.test(symptoms);
    if (melenaDetected) {
      concernLevel = 'high';
    } else if (bloodDetected && concernLevel === 'low') {
      concernLevel = 'medium';
    }

    // ── 레드플래그 concern 하한 보정 (AI 응답과 무관, 서버 강제) ──
    // 치명 감염성(파보·디스템퍼·범백·FIP·광견병) 매칭 → high, 그 외(고양이 안과 감염) → 최소 medium.
    // floor 만 올림(절대 내리지 않음) → KO/EN 공통, 누락 위험 차단.
    if (redFlagMatches.length > 0) {
      const wantHigh = redFlagMatches.some((m) => m.concernFloor === 'high');
      if (wantHigh) {
        concernLevel = 'high';
      } else if (concernLevel === 'low') {
        concernLevel = 'medium';
      }
    }

    // reassurance / watch_signs — high 일 땐 의도적으로 생략 (응급 신호 강조에 집중).
    const rawReassurance = typeof parsed.reassurance === 'string' ? parsed.reassurance.trim() : '';
    let reassurance = concernLevel !== 'high' && rawReassurance ? rawReassurance : undefined;

    let watchSigns: string[] = Array.isArray(parsed.watch_signs)
      ? parsed.watch_signs
          .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim())
          .slice(0, 3)
      : [];

    // Fallback — disease 0개 + reassurance 누락 시 기본 안심 메시지 제공.
    // AI 가 가끔 모든 필드 다 비우는 케이스 (특히 매우 가벼운 증상) 대비.
    // 빈 화면 회피 → 보호자가 최소한의 가이드라도 받게.
    if (correctedDiseases.length === 0 && concernLevel !== 'high' && !reassurance) {
      reassurance = en
        ? "The current symptoms alone aren't enough to suspect a specific disease. It may be a temporary change, so please keep an eye on it for a few more days."
        : '현재 증상만으로는 특정 질병을 의심할 만한 근거가 충분하지 않아요. 일시적인 변화일 가능성이 있으니 며칠 더 지켜봐 주세요.';
    }
    if (correctedDiseases.length === 0 && concernLevel !== 'high' && watchSigns.length === 0) {
      watchSigns = en
        ? ['If it lasts more than a week', 'If other symptoms appear together', 'If activity or appetite differs from usual']
        : ['증상이 1주일 이상 지속될 때', '다른 증상이 함께 나타날 때', '활동성·식욕이 평소와 다를 때'];
    }

    // 출혈이 medium 으로 격상된 케이스: AI 의 안심 문구가 "정상" 톤일 수 있어 보수적으로 교체.
    if (bloodDetected && concernLevel === 'medium') {
      reassurance = en
        ? 'These symptoms involve bleeding. The cause may be mild, but we recommend a veterinary visit soon to confirm.'
        : '출혈이 동반된 증상이에요. 가벼운 원인일 수도 있지만, 정확한 확인을 위해 가까운 시일 내 진료를 권장해요.';
      if (watchSigns.length === 0) {
        watchSigns = en
          ? ['If bleeding increases or recurs', 'If lethargy, loss of appetite, or vomiting appears', 'If black/tarry stool appears']
          : ['출혈량이 늘거나 반복될 때', '무기력·식욕부진·구토가 동반될 때', '검은색/타르 같은 변이 보일 때'];
      }
    }

    // medium 안심문구 도입부의 "정상(적인) 행동일 가능성도 있지만," 류 제거.
    //   medium 은 "지켜볼 필요"인데 정상 가능성으로 운을 떼면 경중이 흐려져 보호자가 방심할 수 있음.
    //   (low 는 실제로 정상 가능성이 커서 그대로 둠) 프롬프트에서도 배제하지만 안전망으로 한 번 더 정리.
    if (concernLevel === 'medium' && reassurance) {
      const cleaned = reassurance
        .replace(/^\s*정상[^,.]*?(행동|가능성)[^,.]*?(있지만|있으나)\s*[,·]?\s*/, '')
        .trim();
      if (cleaned) reassurance = cleaned;
    }

    const result = {
      diseases: correctedDiseases,
      followup_questions: (parsed.followup_questions ?? []).slice(0, 3),
      emergency_signs: normalizedEmergencySigns,
      concern_level: concernLevel,
      ...(reassurance ? { reassurance } : {}),
      ...(watchSigns.length > 0 && concernLevel !== 'high' ? { watch_signs: watchSigns } : {}),
      // 펫 컨텍스트 사용 여부 + 펫 이름 — UI 에 "✨ 살구의 정보 반영" 배지 표시용.
      // 미사용/펫 없음 케이스에선 false / undefined 로 배지 안 뜸.
      context_used: petContext != null && usePetContext,
      pet_name: usePetContext ? petContext?.pet.name : undefined,
      usage: {
        kind,
        used: newUsed,
        limit,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'openai', action: 'symptom-analysis' },
    });
    console.error('Symptom analysis error:', error);
    return NextResponse.json({ error: 'Symptom analysis failed.' }, { status: 500 });
  }
}
