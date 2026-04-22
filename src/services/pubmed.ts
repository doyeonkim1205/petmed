// 이 모듈은 클라이언트에서 사용되며, NCBI API 를 직접 때리지 않고 서버
// 프록시(/api/pubmed) 경유로 호출한다. NCBI_API_KEY 가 서버에 숨겨지고,
// 429 재시도 로직을 서버에서 흡수해서 UI 안정성이 올라감.
//
// MeSH 동물 필터와 3단계 폴백 쿼리 구성은 여기(클라) 에서 그대로 유지.

export interface ArticleSummary {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract?: string;
}

/**
 * 서버 프록시를 통해 PubMed 를 호출한다. 클라이언트에서 authFetch 로 인증 헤더를 붙여야 함.
 */
async function pubmedProxy(body: Record<string, unknown>): Promise<any> {
  const { authFetch } = await import('@/lib/authFetch');
  const res = await authFetch('/api/pubmed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`pubmed proxy failed: ${res.status}`);
  }
  return await res.json();
}

/**
 * PubMed esearch — 검색어로 PMID 목록 조회
 *
 * 검색 전략:
 * - MeSH 동물 필터 사용 ("Cats"[Mesh] / "Dogs"[Mesh]) — 정확한 종 분류 (사람 논문 제외)
 * - 질병명에서 feline/canine 접두어 자동 제거 (MeSH가 종을 필터링하므로 불필요)
 * - 3단계 폴백: Title → Title/Abstract → 자유 텍스트
 */
export async function searchPubMed(
  query: string,
  petType: 'cat' | 'dog' = 'cat',
  maxResults = 5,
): Promise<string[]> {
  // MeSH 동물 필터 — PubMed가 "고양이/강아지 연구"로 분류한 논문만 (인간 논문 제외)
  const meshPetFilter = petType === 'cat' ? '"Cats"[Mesh]' : '"Dogs"[Mesh]';
  // 폴백용 자유 텍스트 필터 (MeSH 인덱싱 안 된 최신 논문용)
  const textPetFilter = petType === 'cat'
    ? '(cat OR cats OR feline OR kitten)'
    : '(dog OR dogs OR canine OR puppy)';

  // 질병명에서 feline/canine 접두어 제거 (MeSH가 종을 필터링하므로 불필요, 오히려 결과 줄임)
  const cleanQuery = query
    .replace(/^(feline|canine)\s+/i, '')
    .trim();

  const currentYear = new Date().getFullYear();
  const dateFilter = `("${currentYear - 10}"[PDAT]:"${currentYear}"[PDAT])`;

  // 1단계: 질병명이 제목에 등장 + MeSH 동물종 + 최근 10년
  const strictQuery = `(${cleanQuery}[Title]) AND ${meshPetFilter} AND ${dateFilter}`;
  let ids = await esearch(strictQuery, maxResults);
  if (ids.length > 0) return ids;

  // 2단계: 질병명이 제목/초록에 등장 + MeSH 동물종
  const mediumQuery = `(${cleanQuery}[Title/Abstract]) AND ${meshPetFilter}`;
  ids = await esearch(mediumQuery, maxResults);
  if (ids.length > 0) return ids;

  // 3단계: 자유 텍스트 + 텍스트 동물 필터 (MeSH 미인덱싱 논문 폴백)
  const broadQuery = `(${cleanQuery}) AND ${textPetFilter}`;
  ids = await esearch(broadQuery, maxResults);

  return ids;
}

/** PubMed esearch 단일 호출 (서버 프록시 경유) */
async function esearch(query: string, maxResults: number): Promise<string[]> {
  try {
    const data = await pubmedProxy({ action: 'search', query, maxResults });
    return data.ids ?? [];
  } catch {
    return [];
  }
}

/**
 * PubMed esummary — PMID 목록으로 제목/저자/저널/날짜 조회
 */
export async function fetchArticleSummaries(
  pmids: string[],
): Promise<ArticleSummary[]> {
  if (pmids.length === 0) return [];

  const data = await pubmedProxy({ action: 'summary', pmids });
  const result = data.result ?? {};

  return pmids.map((id) => {
    const doc = result[id];
    if (!doc) {
      return { pmid: id, title: '', authors: [], journal: '', pubDate: '' };
    }
    return {
      pmid: id,
      title: doc.title ?? '',
      authors: (doc.authors ?? []).map(
        (a: { name: string }) => a.name,
      ),
      journal: doc.fulljournalname ?? doc.source ?? '',
      pubDate: doc.pubdate ?? '',
    };
  });
}

/**
 * PubMed efetch — 단일 PMID의 초록(abstract) 조회 (XML 파싱)
 */
export async function fetchAbstract(pmid: string): Promise<string> {
  const data = await pubmedProxy({ action: 'abstract', pmid });
  const xml: string = data.xml ?? '';

  // XML에서 <AbstractText> 추출
  const abstractTexts: string[] = [];
  const regex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    // Label 속성이 있으면 앞에 붙임
    const labelMatch = match[0].match(/Label="([^"]+)"/);
    const label = labelMatch ? `${labelMatch[1]}: ` : '';
    // XML 태그 제거
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    abstractTexts.push(label + text);
  }

  return abstractTexts.length > 0
    ? abstractTexts.join('\n\n')
    : 'Abstract not available.';
}

/**
 * PMID → PubMed 논문 URL 생성
 */
export function getPubMedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}
