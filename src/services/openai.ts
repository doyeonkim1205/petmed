export interface AiAnalysisResult {
  /** 논문 제목 한국어 번역 */
  titles: string[];
  /** 논문별 한국어 요약 (각 1-2문장) */
  summaries: string[];
  /** 논문별 관련성 (true=직접 관련, false=간접/무관) */
  relevant: boolean[];
  /** 주의사항 & 대처방법 (최대 5개) */
  precautions: string[];
  /** 도움되는 성분 (최대 5개) */
  ingredients: string[];
}

/**
 * PubMed 논문 분석 — 서버 API 경유 (모바일 호환 + API 키 보호)
 */
export interface DiseaseDescription {
  name_ko: string;
  name_en: string;
  description: string;
  symptoms: string[];
  when_to_visit: string;
}

export async function fetchDiseaseDescription(
  diseaseName: string,
  petType: 'cat' | 'dog',
): Promise<DiseaseDescription> {
  const { authFetch } = await import('@/lib/authFetch');
  const res = await authFetch('/api/disease-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diseaseName, petType }),
  });
  if (!res.ok) throw new Error('질병 설명 생성 실패');
  return await res.json();
}

export async function analyzePapers(
  diseaseName: string,
  petType: 'cat' | 'dog',
  papers: { pmid: string; title: string; journal: string; pubDate: string; abstract?: string }[],
): Promise<AiAnalysisResult> {
  const { authFetch } = await import('@/lib/authFetch');
  const res = await authFetch('/api/analyze-papers', {
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

