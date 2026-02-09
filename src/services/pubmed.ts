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
 */
export async function searchPubMed(
  query: string,
  petType: 'cat' | 'dog' = 'cat',
  maxResults = 5,
): Promise<string[]> {
  const petFilter = petType === 'cat'
    ? '(cat OR cats OR feline OR kitten)'
    : '(dog OR dogs OR canine OR puppy)';
  const searchQuery = `${query} AND ${petFilter}`;
  const url = `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&sort=relevance&term=${encodeURIComponent(searchQuery)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`esearch failed: ${res.status}`);

  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
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
