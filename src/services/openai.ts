const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY as string;

export interface AiAnalysisResult {
  /** 논문 제목 한국어 번역 */
  titles: string[];
  /** 논문별 한국어 요약 (각 1-2문장) */
  summaries: string[];
  /** 주의사항 & 대처방법 (최대 5개) */
  precautions: string[];
  /** 도움되는 성분 (최대 5개) */
  ingredients: string[];
}

/**
 * PubMed 논문 제목들을 GPT에게 보내서
 * 각 논문 개별 한국어 요약 + 주의사항 + 성분 추출
 */
export async function analyzePapers(
  diseaseName: string,
  petType: 'cat' | 'dog',
  papers: { pmid: string; title: string; journal: string; pubDate: string }[],
): Promise<AiAnalysisResult> {
  const petLabel = petType === 'cat' ? '고양이' : '강아지';

  const papersText = papers
    .map((p, i) => `[논문 ${i + 1}] ${p.title} (${p.journal}, ${p.pubDate})`)
    .join('\n');

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
          content: `너는 수의학 논문 분석 전문가야. 사용자가 제공하는 PubMed 논문 정보를 바탕으로 반드시 아래 JSON 형식으로만 응답해.

{
  "titles": ["논문1 제목 한국어 번역", "논문2 제목 한국어 번역", ...],
  "summaries": ["논문1 요약", "논문2 요약", ...],
  "precautions": ["주의사항1", "주의사항2", ...],
  "ingredients": ["성분1", "성분2", ...]
}

규칙:
- titles: 각 논문의 영문 제목을 자연스러운 한국어로 번역. 반드시 논문 수와 동일한 개수로 작성
- summaries: 각 논문을 ${petLabel} 보호자가 이해할 수 있게 한국어 1-2문장으로 개별 요약. 반드시 논문 수와 동일한 개수로 작성
- precautions: 모든 논문을 종합하여 ${petLabel}의 ${diseaseName}에 대한 가장 신뢰할 수 있는 주의사항과 대처방법을 최대 5개 추출. 여러 논문에서 공통으로 언급되는 내용 우선
- ingredients: 논문들에서 언급된 도움이 되는 성분, 영양소, 치료 물질을 최대 5개 추출. "성분명 (한국어 설명)" 형식
- 논문에 근거가 없는 내용은 절대 포함하지 마`,
        },
        {
          role: 'user',
          content: `${petLabel}의 "${diseaseName}"에 대한 PubMed 논문 ${papers.length}편입니다. 각 논문을 개별적으로 요약하고, 전체를 종합하여 주의사항과 도움되는 성분을 추출해주세요.\n\n${papersText}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API failed: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      titles: parsed.titles ?? [],
      summaries: parsed.summaries ?? [],
      precautions: (parsed.precautions ?? []).slice(0, 5),
      ingredients: (parsed.ingredients ?? []).slice(0, 5),
    };
  } catch {
    throw new Error('OpenAI 응답 파싱 실패');
  }
}
