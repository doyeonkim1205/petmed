const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface ArticleSummary {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract?: string;
}

/**
 * PubMed esearch — 검색어로 PMID 목록 조회
 *
 * 검색 전략 (3단계 폴백):
 * 1. 엄격 검색: 질병 + 동물종 + 수의학 + 최근 10년 + 리뷰/임상시험 우선
 * 2. 중간 검색: 질병 + 동물종 + 수의학 (연도/논문타입 제한 없음)
 * 3. 완화 검색: 질병 + 동물종 (수의학 제한도 해제)
 */
export async function searchPubMed(
  query: string,
  petType: 'cat' | 'dog' = 'cat',
  maxResults = 5,
): Promise<string[]> {
  const petFilter = petType === 'cat'
    ? '(cat OR cats OR feline OR kitten)'
    : '(dog OR dogs OR canine OR puppy)';

  const vetFilter = '(veterinary OR "animal model" OR "companion animal")';

  // 최근 10년 필터 (정확한 PubMed 날짜 구문)
  const currentYear = new Date().getFullYear();
  const dateFilter = `("${currentYear - 10}"[PDAT]:"${currentYear}"[PDAT])`;

  // 고품질 논문 타입 필터
  const qualityFilter = '(Review[pt] OR Meta-Analysis[pt] OR Systematic Review[pt] OR Clinical Trial[pt] OR Randomized Controlled Trial[pt])';

  // 1단계: 엄격 검색 — 질병 + 동물종 + 수의학 + 최근 10년 + 논문타입
  const strictQuery = `(${query}) AND ${petFilter} AND ${vetFilter} AND ${dateFilter} AND ${qualityFilter}`;
  let ids = await esearch(strictQuery, maxResults);

  // 1단계에서 결과가 있으면 그대로 사용 (관련성 높은 결과 우선)
  if (ids.length > 0) return ids;

  // 2단계: 중간 검색 — 연도/논문타입 제한 해제 (1단계 결과 0건일 때만)
  const mediumQuery = `(${query}) AND ${petFilter} AND ${vetFilter}`;
  ids = await esearch(mediumQuery, maxResults);

  if (ids.length > 0) return ids;

  // 3단계: 완화 검색 — 수의학 제한도 해제 (2단계도 0건일 때만)
  const broadQuery = `(${query}) AND ${petFilter}`;
  ids = await esearch(broadQuery, maxResults);

  return ids;
}

/** PubMed esearch 단일 호출 */
async function esearch(query: string, maxResults: number): Promise<string[]> {
  const url = `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&sort=relevance&term=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

/** 중복 없이 두 배열 합치기 */
function deduplicateMerge(a: string[], b: string[], max: number): string[] {
  const set = new Set(a);
  for (const id of b) {
    if (set.size >= max) break;
    set.add(id);
  }
  return [...set];
}

/**
 * PubMed esummary — PMID 목록으로 제목/저자/저널/날짜 조회
 */
export async function fetchArticleSummaries(
  pmids: string[],
): Promise<ArticleSummary[]> {
  if (pmids.length === 0) return [];

  const url = `${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`esummary failed: ${res.status}`);

  const data = await res.json();
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
  const url = `${BASE}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${pmid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`efetch failed: ${res.status}`);

  const xml = await res.text();

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
