'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  searchPubMed,
  fetchArticleSummaries,
  fetchAbstract,
  ArticleSummary,
} from '@/services/pubmed';
import { analyzePapers, AiAnalysisResult, fetchDiseaseDescription, DiseaseDescription } from '@/services/openai';
import { supabase } from '@/lib/supabase';

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
  isCached: boolean;
}

/**
 * 캐시 키 생성: query + petType 조합
 */
function makeCacheKey(query: string, petType: string): string {
  return `${query.trim().toLowerCase()}:${petType}`;
}

/**
 * 캐시 조회 (24시간 이내)
 */
async function checkCache(query: string, petType: string) {
  try {
    const key = makeCacheKey(query, petType);
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('search_cache')
      .select('articles, analysis, disease_description')
      .eq('cache_key', key)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

/**
 * 캐시 저장 (upsert)
 */
async function saveCache(
  query: string,
  petType: string,
  articles: ArticleSummary[],
  analysis: AiAnalysisResult | null,
  diseaseDescription: DiseaseDescription | null,
) {
  try {
    const key = makeCacheKey(query, petType);
    await supabase.from('search_cache').upsert(
      {
        cache_key: key,
        query,
        pet_type: petType,
        articles,
        analysis,
        disease_description: diseaseDescription,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    );
  } catch (e) {
    console.error('[캐시 저장 실패]', e);
  }
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
  const [isCached, setIsCached] = useState(false);

  const fetchArticles = useCallback(async () => {
    if (!diseaseName) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setArticles([]);
    setLimitReached(false);
    setDiseaseDescription(null);
    setIsCached(false);

    // Step 1: 검증 + 번역을 먼저 수행 (무효한 검색어는 횟수 차감하지 않음)
    setStep('validating');
    const result = await validateAndTranslate(diseaseName, petType);
    if (!result.valid || !result.englishQuery) {
      setError(result.reason || '반려동물 질병이나 증상과 관련된 검색어를 입력해주세요.');
      setLoading(false);
      setStep('done');
      return;
    }

    // Step 2: 검증 통과 후 횟수 차감 (캐시 여부와 무관하게 항상 차감)
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

    // Step 3: 캐시 확인 (24시간 이내 동일 검색어 → 즉시 반환)
    const cached = await checkCache(diseaseName, petType);
    if (cached && cached.articles && cached.articles.length > 0) {
      setArticles(cached.articles as ArticleSummary[]);
      setAnalysis(cached.analysis as AiAnalysisResult | null);
      setDiseaseDescription(cached.disease_description as DiseaseDescription | null);
      setIsCached(true);
      setLoading(false);
      setStep('done');
      return;
    }

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

      // Step 4: AI 분석 — 2-batch 병렬 분석 (서버에서 자동 처리)
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

        let finalArticles: ArticleSummary[];
        let finalAnalysis: AiAnalysisResult;

        if (relevantIndices.length >= 2) {
          // 관련 논문이 2편 이상이면 관련 논문만 표시
          finalArticles = relevantIndices.map((i) => enrichedSummaries[i]);
          finalAnalysis = {
            titles: relevantIndices.map((i) => aiResult.titles[i]),
            summaries: relevantIndices.map((i) => aiResult.summaries[i]),
            relevant: relevantIndices.map(() => true),
            precautions: aiResult.precautions,
            ingredients: aiResult.ingredients,
          };
        } else {
          // 관련 논문이 1편 이하면 전체 표시 (검색 결과가 적은 경우)
          finalArticles = enrichedSummaries.slice(0, 5);
          finalAnalysis = aiResult;
        }

        setArticles(finalArticles);
        setAnalysis(finalAnalysis);

        // 캐시에 저장 (백그라운드, 에러 무시)
        saveCache(diseaseName, petType, finalArticles, finalAnalysis, desc);
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
    isCached,
  };
}
