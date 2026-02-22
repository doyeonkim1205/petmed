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
 * 검색 전략:
 * - MeSH 동물 필터 사용 ("Cats"[Mesh] / "Dogs"[Mesh]) — 정확한 종 분류
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
