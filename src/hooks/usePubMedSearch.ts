'use client';

import { useState, useEffect, useCallback } from 'react';
import { toEnglishQuery } from '@/data/diseaseMap';
import {
  searchPubMed,
  fetchArticleSummaries,
  ArticleSummary,
} from '@/services/pubmed';
import { analyzePapers, AiAnalysisResult } from '@/services/openai';

export type SearchStep = 'idle' | 'validating' | 'translating' | 'searching' | 'fetching' | 'analyzing' | 'done';

export interface UsePubMedSearchResult {
  articles: ArticleSummary[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  analysis: AiAnalysisResult | null;
  analysisLoading: boolean;
  step: SearchStep;
}

/**
 * 검색어가 반려동물 건강 관련인지 서버에서 AI로 검증
 */
async function validateSearchTerm(query: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const res = await fetch('/api/validate-search', {
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

  const fetchArticles = useCallback(async () => {
    if (!diseaseName) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setArticles([]);

    // Step 0: AI 기반 검색어 검증
    setStep('validating');
    const validation = await validateSearchTerm(diseaseName);
    if (!validation.valid) {
      setError(validation.reason || '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.');
      setLoading(false);
      setStep('done');
      return;
    }

    try {
      setStep('translating');
      const englishQuery = await toEnglishQuery(diseaseName);

      setStep('searching');
      const pmids = await searchPubMed(englishQuery, petType, 5);

      if (pmids.length === 0) {
        setArticles([]);
        setLoading(false);
        setStep('done');
        return;
      }

      setStep('fetching');
      const summaries = await fetchArticleSummaries(pmids);
      setArticles(summaries);
      setLoading(false);

      setStep('analyzing');
      setAnalysisLoading(true);
      try {
        const result = await analyzePapers(
          diseaseName,
          petType,
          summaries.map((s) => ({
            pmid: s.pmid,
            title: s.title,
            journal: s.journal,
            pubDate: s.pubDate,
          })),
        );
        setAnalysis(result);
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
  };
}
