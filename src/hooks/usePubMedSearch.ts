'use client';

import { useState, useEffect, useCallback } from 'react';
import { toEnglishQuery } from '@/data/diseaseMap';
import {
  searchPubMed,
  fetchArticleSummaries,
  ArticleSummary,
} from '@/services/pubmed';
import { analyzePapers, AiAnalysisResult } from '@/services/openai';

export type SearchStep = 'idle' | 'translating' | 'searching' | 'fetching' | 'analyzing' | 'done';

export interface UsePubMedSearchResult {
  articles: ArticleSummary[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  analysis: AiAnalysisResult | null;
  analysisLoading: boolean;
  step: SearchStep;
}

export function usePubMedSearch(
  diseaseName: string | null,
  petType: 'cat' | 'dog' = 'cat',
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
    setStep('translating');

    try {
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
  }, [diseaseName, petType]);

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
