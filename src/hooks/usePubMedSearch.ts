'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  searchPubMed,
  fetchArticleSummaries,
  fetchAbstract,
  ArticleSummary,
} from '@/services/pubmed';
import { analyzePapers, AiAnalysisResult, fetchDiseaseDescription, DiseaseDescription } from '@/services/openai';

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
  diseaseDescription: DiseaseDescription | null;
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
async function validateAndTranslate(query: string, petType: 'cat' | 'dog'): Promise<{
  valid: boolean;
  reason?: string;
  englishQuery?: string;
}> {
  try {
    const { authFetch } = await import('@/lib/authFetch');
    const res = await authFetch('/api/validate-and-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, petType }),
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
  const [diseaseDescription, setDiseaseDescription] = useState<DiseaseDescription | null>(null);

  const fetchArticles = useCallback(async () => {
    if (!diseaseName) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setArticles([]);
    setLimitReached(false);
    setDiseaseDescription(null);

    // Step 1: 검증 + 번역을 먼저 수행 (무효한 검색어는 횟수 차감하지 않음)
    setStep('validating');
    const result = await validateAndTranslate(diseaseName, petType);
    if (!result.valid || !result.englishQuery) {
      setError(result.reason || '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.');
      setLoading(false);
      setStep('done');
      return;
    }

    // Step 0: 검증 통과 후 횟수 차감
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

    // 질병 설명을 병렬로 가져오기 (논문 검색과 동시 실행)
    const descriptionPromise = fetchDiseaseDescription(diseaseName, petType).catch(() => null);

    try {
      // Step 2: PubMed 검색 — 10편 가져와서 AI가 관련 논문 5편 선별
      setStep('searching');
      const pmids = await searchPubMed(result.englishQuery, petType, 10);

      if (pmids.length === 0) {
        setArticles([]);
        // 논문이 없어도 질병 설명은 표시
        const desc = await descriptionPromise;
        if (desc) setDiseaseDescription(desc);
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

      // 질병 설명이 완료되었으면 먼저 세팅 (로딩 중에 보여줌)
      const desc = await descriptionPromise;
      if (desc) setDiseaseDescription(desc);

      // Step 4: AI 분석 — 10편 분석 후 관련 논문만 필터링
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

        // 관련 논문만 필터링 (최대 5편)
        const relevantIndices = aiResult.relevant
          .map((r, i) => (r ? i : -1))
          .filter((i) => i >= 0)
          .slice(0, 5);

        if (relevantIndices.length >= 2) {
          // 관련 논문이 2편 이상이면 관련 논문만 표시
          const filteredArticles = relevantIndices.map((i) => enrichedSummaries[i]);
          const filteredAnalysis: AiAnalysisResult = {
            titles: relevantIndices.map((i) => aiResult.titles[i]),
            summaries: relevantIndices.map((i) => aiResult.summaries[i]),
            relevant: relevantIndices.map(() => true),
            precautions: aiResult.precautions,
            ingredients: aiResult.ingredients,
          };
          setArticles(filteredArticles);
          setAnalysis(filteredAnalysis);
        } else {
          // 관련 논문이 1편 이하면 전체 표시 (검색 결과가 적은 경우)
          setArticles(enrichedSummaries.slice(0, 5));
          setAnalysis(aiResult);
        }
      } catch (aiErr) {
        console.error('[AI 분석 실패]', aiErr);
        // AI 실패 시 원본 5편 그대로 표시
        setArticles(enrichedSummaries.slice(0, 5));
      } finally {
        setLoading(false);
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
    diseaseDescription,
  };
}
