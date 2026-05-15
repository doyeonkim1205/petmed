import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * PubMed (NCBI E-utilities) 서버 프록시.
 *
 * 왜 서버 프록시가 필요한가:
 *   - NCBI API key 를 브라우저에 노출하지 않기 위함 (NEXT_PUBLIC_* 안 써도 됨).
 *   - 429 Too Many Requests 를 받으면 서버에서 재시도 → 클라이언트는 성공만 받음.
 *   - 모든 PubMed 호출을 한 엔드포인트로 묶어서 변경/모니터링 용이.
 *
 * 요청 형식: POST { action: 'search'|'summary'|'abstract', ... }
 */

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_API_KEY = process.env.NCBI_API_KEY;

/**
 * API key 파라미터를 붙여준다. key 없으면 비워둠 (3 req/sec 제한).
 * key 있으면 10 req/sec 로 상승 → "심장병" 같은 빈번 검색도 429 회피.
 */
function withApiKey(url: string): string {
  if (!NCBI_API_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}api_key=${NCBI_API_KEY}`;
}

/**
 * NCBI fetch + 429/5xx 재시도 (최대 2회, exponential backoff).
 *
 * key 가 있어도 동시성 타이밍 때문에 간헐적으로 429 가 나올 수 있어 서버에서
 * 조용히 재시도. 유저 입장에선 딱 한 번 성공한 걸로 보임.
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(withApiKey(url), {
      ...options,
      // NCBI E-utilities 사용 정책상 tool/email 파라미터 권장 — 여기선 User-Agent 로만.
      headers: { 'User-Agent': 'PawDex/1.0 (https://pawdex.store)' },
    });
    if (res.ok) return res;
    // 429 (rate limit) 또는 5xx (일시 오류) 만 재시도. 4xx (400/403) 은 즉시 포기.
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    } else {
      return res;
    }
  }
  // 이 라인은 unreachable (루프에서 return) 이지만 TS 용 안전장치.
  throw new Error('unreachable');
}

async function doSearch(query: string, maxResults: number): Promise<string[]> {
  const url = `${BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&sort=relevance&term=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

async function doSummary(pmids: string[]): Promise<any> {
  if (pmids.length === 0) return { result: {} };
  const url = `${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(',')}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`esummary failed: ${res.status}`);
  return await res.json();
}

async function doAbstract(pmid: string): Promise<string> {
  const url = `${BASE}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${pmid}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`efetch failed: ${res.status}`);
  return await res.text();
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  // 버스트 방어 — 정상 유저 한 번 검색 = search 1 + summary 1 + abstract N(≤10) = 최대 12건.
  // 30/min 이면 분당 2.5 검색 허용. 매크로 스팸만 차단.
  if (!checkRateLimit(`${userId}:pubmed`, 30, 60_000)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'search') {
      const { query, maxResults = 5 } = body;
      if (typeof query !== 'string' || !query) {
        return NextResponse.json({ error: 'query required' }, { status: 400 });
      }
      const ids = await doSearch(query, Math.min(Math.max(1, maxResults), 20));
      return NextResponse.json({ ids });
    }

    if (action === 'summary') {
      const { pmids } = body;
      if (!Array.isArray(pmids)) {
        return NextResponse.json({ error: 'pmids required' }, { status: 400 });
      }
      const data = await doSummary(pmids.slice(0, 20));
      return NextResponse.json(data);
    }

    if (action === 'abstract') {
      const { pmid } = body;
      if (typeof pmid !== 'string' || !pmid) {
        return NextResponse.json({ error: 'pmid required' }, { status: 400 });
      }
      const xml = await doAbstract(pmid);
      return NextResponse.json({ xml });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[pubmed proxy] error:', err);
    return NextResponse.json({ error: 'PubMed 호출에 실패했습니다.' }, { status: 502 });
  }
}
