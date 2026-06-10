import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { startOfDayKST } from '@/lib/dailyBoundary';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * 영수증 OCR API — gpt-4o-mini Vision.
 *
 * 동물병원 영수증/명세서 사진 → 구조화 추출(병원명·날짜·합계·항목·카테고리·요약).
 *  - 게이팅: Free 평생 체험(receiptOcrLifetimeFree) / Plus 일일(receiptOcrPerDay). kind='receipt_ocr'.
 *  - 병원마다 양식이 달라 템플릿 파싱 불가 → Vision 으로 "의미 단위" 추출 + 클라 확인/수정 필수.
 *  - 총액은 최종 결제 "합계/총합계"(할인 반영 후). 청구금액(할인 전) 잡지 않도록 프롬프트로 강제.
 *  - 환각 방지: 보이는 것만. 총액만 있으면 items=[]. 영수증 아니면 is_receipt=false.
 *  - 항목은 이름(원문 그대로)·금액·카테고리만 추출 (해석/설명 X — 정확도·비용 우선).
 *
 * 이미지는 저장하지 않음 — 분석 후 폐기. 원본 보관은 클라이언트가 첨부로 선택.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const CATEGORIES = ['consult', 'test', 'med', 'treatment', 'vaccine', 'etc'] as const;
type Category = (typeof CATEGORIES)[number];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    if (!checkRateLimit(`${userId}:receipt-ocr`, 5, 60_000)) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다 잠시 후 다시 시도해주세요' },
        { status: 429 },
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { imageDataUrl } = await request.json();

    // 1) 입력 검증 + 2MB 가드 (클라 압축 우회 방어)
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: '이미지 파일이 올바르지 않아요' }, { status: 400 });
    }
    const base64Body = imageDataUrl.split(',')[1] || '';
    const approxBytes = Math.floor((base64Body.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: '이미지가 너무 커요 더 작은 사진을 사용해 주세요' }, { status: 413 });
    }

    // 2) 플랜 + 한도 게이팅 (사진분석과 동일 패턴)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    const plan = getEffectivePlan(profile?.plan);
    const config = getPlanConfig(plan);

    if (plan === 'free') {
      if (config.receiptOcrLifetimeFree === 0) {
        return NextResponse.json(
          { error: '영수증 자동 입력은 Plus 플랜에서 사용할 수 있어요', upgradeRequired: true },
          { status: 403 },
        );
      }
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'receipt_ocr');
      if ((count || 0) >= config.receiptOcrLifetimeFree) {
        return NextResponse.json(
          {
            error: '영수증 자동 입력 무료 체험을 모두 사용했어요.\nPlus로 업그레이드하면 계속 사용할 수 있어요',
            limitReached: true,
            upgradeRequired: true,
          },
          { status: 429 },
        );
      }
    } else {
      const startOfDay = startOfDayKST();
      const { count } = await supabaseAdmin
        .from('search_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'receipt_ocr')
        .gte('created_at', startOfDay.toISOString());
      if ((count || 0) >= config.receiptOcrPerDay) {
        return NextResponse.json(
          {
            error: `오늘의 영수증 스캔 횟수(${config.receiptOcrPerDay}회)를 모두 사용했습니다\n밤 12시(자정)에 초기화됩니다`,
            limitReached: true,
          },
          { status: 429 },
        );
      }
    }

    // 3) Vision 프롬프트 — 양식 무관 의미 추출 + 카테고리 + 안전.
    const systemPrompt = `당신은 한국 동물병원 영수증/진료비 명세서를 읽는 정확한 파서입니다.
사진 속 영수증에서 보이는 정보만 추출해 JSON 으로 반환하세요. 보이지 않으면 null 또는 빈 배열로 두고, 절대 지어내지 마세요.

[추출 항목]
- hospital_name: 병원/동물병원 이름 (없으면 null)
- date: 발행일/진료일 (YYYY-MM-DD, 없으면 null)
- total: 최종 결제 합계 금액 (숫자만). ★중요: "합계 / 총합계 / 총 결제금액"처럼 할인이 반영된 최종 금액을 사용. "청구금액"(할인 전)이 아니라 할인 후 합계를 잡을 것. 없으면 null
- pet_name: 반려동물 이름 (없으면 null)
- items: 진료/처치/검사/약 등 개별 항목 배열. 각 항목 { name, amount, category }
   · name: 영수증에 인쇄된 글자 그대로 옮길 것. ★절대 다른 말로 바꾸거나 표준화하지 말 것
       (예: "진료비"를 "진찰료"로, "특수약물"을 다른 이름으로 바꾸기 금지). 영문 약품명/괄호도 그대로.
       글자가 안 읽히면 추측해서 만들지 말고 읽히는 부분만. ★해석·설명을 덧붙이지 말 것 (이름은 원문 그대로만)
   · amount: 그 항목 금액 (숫자만). 금액이 안 보이면 0
   · category: 다음 중 하나
       consult(진찰/재진/처방료) / test(혈액·초음파·방사선·뇨·분변 등 검사) /
       med(주사·내복약·처방약) / treatment(처치·수술·마취·봉합·입원) / vaccine(종합백신·광견병·심장사상충 등 예방) / etc(그 외)
- summary: 큰 카테고리만 묶은 한 줄 요약 (40자 이내). 예: "진찰 · 혈액/초음파 검사 · 입원 · 약 처방"
- is_receipt: 동물병원 영수증/명세서가 맞으면 true, 아니면(다른 사진) false
- confidence: 추출 확신도 "low" | "medium" | "high" (흐림/회전/일부 가림이면 low)

[규칙]
- 항목이 안 보이고 총액만 있는 영수증 → items 는 빈 배열 [], total 만 채움
- 같은 항목을 임의로 쪼개거나 만들지 말 것
- 금액에 콤마/원 표기는 제거하고 숫자만 (예: "659,340원" → 659340)
- is_receipt=false 면 나머지는 null/빈 배열

반드시 아래 JSON 형식으로만 답하세요:
{
  "is_receipt": true,
  "hospital_name": "string|null",
  "date": "YYYY-MM-DD|null",
  "total": 0,
  "pet_name": "string|null",
  "items": [ { "name": "항목명", "amount": 0, "category": "test" } ],
  "summary": "string",
  "confidence": "low|medium|high"
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        // 영수증은 OCR 정확도가 핵심 (접힘·회전·할인컬럼·영문약품명) → mini 보다 정확한 gpt-4o.
        // 스캔 빈도 낮음(Free 평생1·Plus 일10) 이라 비용 대비 정확도 우선.
        model: 'gpt-4o',
        temperature: 0, // 같은 영수증 = 같은 결과 (일관성 최대화)
        max_tokens: 4000, // 긴 영수증(항목 多) JSON 잘림 방지
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: '이 동물병원 영수증을 분석해주세요.' },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      Sentry.captureMessage('receipt-ocr-openai-fail', { level: 'error', extra: { status: res.status } });
      return NextResponse.json({ error: '영수증 분석 중 오류가 발생했어요 잠시 후 다시 시도해 주세요' }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      Sentry.captureMessage('receipt-ocr-json-parse-fail', { level: 'error' });
      return NextResponse.json({ error: 'AI 응답 처리에 실패했어요 다시 시도해 주세요' }, { status: 502 });
    }

    // 4) 영수증 아님 → 안내 (사용량 차감 X)
    if (parsed.is_receipt === false) {
      return NextResponse.json({
        is_receipt: false,
        error: '영수증이 아닌 것 같아요 동물병원 영수증/명세서를 촬영해 주세요',
      }, { status: 200 });
    }

    // 5) 정규화 — 신뢰 가능한 형태로 정제 (클라 확인/수정 전제)
    const toNumber = (v: unknown): number => {
      if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
      if (typeof v === 'string') {
        const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
        return isFinite(n) ? Math.max(0, n) : 0;
      }
      return 0;
    };
    const normCategory = (c: unknown): Category =>
      typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c) ? (c as Category) : 'etc';

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems
      .map((it: any) => {
        const name = typeof it?.name === 'string' ? it.name.trim().slice(0, 80) : '';
        if (!name) return null;
        return {
          name,
          amount: toNumber(it?.amount),
          category: normCategory(it?.category),
        };
      })
      .filter(Boolean)
      .slice(0, 40); // 항목 과다 방어

    const dateStr = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    const result = {
      is_receipt: true as const,
      hospital_name: typeof parsed.hospital_name === 'string' ? parsed.hospital_name.trim().slice(0, 80) || null : null,
      date: dateStr,
      total: parsed.total != null ? toNumber(parsed.total) : null,
      pet_name: typeof parsed.pet_name === 'string' ? parsed.pet_name.trim().slice(0, 40) || null : null,
      items,
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 60) : '',
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    };

    // 6) 사용량 기록 (dedup 5초 — 재시도 이중 차감 방어)
    const windowStart = new Date(Date.now() - 5_000).toISOString();
    const { data: recentDupe } = await supabaseAdmin
      .from('search_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'receipt_ocr')
      .gte('created_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (!recentDupe) {
      const { error: insertError } = await supabaseAdmin.from('search_logs').insert({
        user_id: userId,
        query: result.hospital_name ? `[영수증: ${result.hospital_name}]` : '[영수증 스캔]',
        kind: 'receipt_ocr',
        result_summary: {
          item_count: items.length,
          total: result.total,
          confidence: result.confidence,
        },
      });
      if (insertError) {
        console.error('search_logs INSERT failed (receipt_ocr):', insertError.message);
        Sentry.captureMessage(`search_logs-insert-fail: ${insertError.message}`, {
          level: 'error',
          extra: { userId, kind: 'receipt_ocr' },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'openai', action: 'receipt-ocr' } });
    console.error('Receipt OCR error:', error);
    return NextResponse.json({ error: '영수증 분석에 실패했어요.' }, { status: 500 });
  }
}
