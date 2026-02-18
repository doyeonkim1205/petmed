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
 * PubMed 논문 분석 — 서버 API 경유 (모바일 호환 + API 키 보호)
 */
export async function analyzePapers(
  diseaseName: string,
  petType: 'cat' | 'dog',
  papers: { pmid: string; title: string; journal: string; pubDate: string }[],
): Promise<AiAnalysisResult> {
  const res = await fetch('/api/analyze-papers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diseaseName, petType, papers }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 분석 실패: ${res.status} - ${err}`);
  }

  return await res.json();
}

// Document analysis types
export interface DocumentAnalysisResult {
  hospital_name: string | null;
  visit_date: string | null;
  diagnosis: string | null;
  treatments: string[];
  medications: {
    name: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
  }[];
  cost: number | null;
  summary: string;
}
