'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  searchPubMed,
  fetchArticleSummaries,
  fetchAbstract,
  ArticleSummary,
} from '@/services/pubmed';
import { analyzePapers, AiAnalysisResult } from '@/services/openai';

export type SearchStep = 'idle' | 'validating' | 'searching' | 'fetching' | 'analyzing' | 'done';

export interface UsePubMedSearchResult {
  articles: ArticleSummary[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  analysis: AiAnalysisResult | null;
  analysisLoading: boolean;
  step: SearchStep;
  limitReached?: boolean;
  plan?: string;
}

/**
 * Rate limit check — returns { allowed, reason?, plan? }
 */
async function checkAndLogSearch(query: string, petType: string): Promise<{
  allowed: boolean;
  reason?: string;
  plan?: string;
}> {
  try {
    const { authFetch } = await import('@/lib/authFetch');
    const res = await authFetch('/api/search-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, petType }),
    });
    if (!res.ok) return { allowed: true }; // fail-open: allow search if rate-limit service is down
    return await res.json();
  } catch {
    return { allowed: true };
  }
}

/**
 * 검증 + 번역을 하나의 API 호출로 처리
 */
async function validateAndTranslate(query: string): Promise<{
  valid: boolean;
  reason?: string;
  englishQuery?: string;
}> {
  try {
    const { authFetch } = await import('@/lib/authFetch');
    const res = await authFetch('/api/validate-and-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { valid: false, reason: '검색어 검증에 실패했습니다.' };
    return await res.json();
  } catch {
    return { valid: false, reason: '검색어 검증에 실패했습니다. 다시 시도해주세요.' };
  }
}

export function usePubMedSearch(
  diseaseName: string | null,
  petType: 'cat' | 'dog' = 'cat',
  searchKey: number = 0,
): UsePubMedSearchResult {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [step, setStep] = useState<SearchStep>('idle');
  const [limitReached, setLimitReached] = useState(false);
  const [plan, setPlan] = useState<string | undefined>();

  const fetchArticles = useCallback(async () => {
    if (!diseaseName) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setArticles([]);
    setLimitReached(false);

    // Step 0: Rate limit check
    const usage = await checkAndLogSearch(diseaseName, petType);
    if (!usage.allowed) {
      setError(usage.reason || '검색 횟수를 초과했습니다.');
      setLimitReached(true);
      setPlan(usage.plan);
      setLoading(false);
      setStep('done');
      return;
    }
    setPlan(usage.plan);

    // Step 1: 검증 + 번역 (하나의 API 호출)
    setStep('validating');
    const result = await validateAndTranslate(diseaseName);
    if (!result.valid || !result.englishQuery) {
      setError(result.reason || '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.');
      setLoading(false);
      setStep('done');
      return;
    }

    try {
      // Step 2: PubMed 검색
      setStep('searching');
      const pmids = await searchPubMed(result.englishQuery, petType, 5);

      if (pmids.length === 0) {
        setArticles([]);
        setLoading(false);
        setStep('done');
        return;
      }

      // Step 3: 논문 정보 + 초록 가져오기
      setStep('fetching');
      const summaries = await fetchArticleSummaries(pmids);

      // 초록을 병렬로 가져오기 (AI 분석 정확도 향상)
      const abstracts = await Promise.all(
        summaries.map(async (s) => {
          try {
            return await fetchAbstract(s.pmid);
          } catch {
            return '';
          }
        })
      );

      // 초록 정보를 summaries에 합침
      const enrichedSummaries = summaries.map((s, i) => ({
        ...s,
        abstract: abstracts[i] || undefined,
      }));

      setArticles(enrichedSummaries);
      setLoading(false);

      // Step 4: AI 분석 (백그라운드) — 초록 포함
      setStep('analyzing');
      setAnalysisLoading(true);
      try {
        const aiResult = await analyzePapers(
          diseaseName,
          petType,
          enrichedSummaries.map((s) => ({
            pmid: s.pmid,
            title: s.title,
            journal: s.journal,
            pubDate: s.pubDate,
            abstract: s.abstract,
          })),
        );
        setAnalysis(aiResult);
      } catch (aiErr) {
        console.error('[AI 분석 실패]', aiErr);
      } finally {
        setAnalysisLoading(false);
        setStep('done');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'PubMed 검색에 실패했습니다.';
      setError(message);
      setArticles([]);
      setLoading(false);
      setStep('done');
    }
  }, [diseaseName, petType, searchKey]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return {
    articles,
    loading,
    error,
    retry: fetchArticles,
    analysis,
    analysisLoading,
    step,
    limitReached,
    plan,
  };
}
