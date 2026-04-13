'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, AlertTriangle, Pill, Loader2, X, Lock, Bookmark, Crown, Sparkles, Info, Stethoscope, ArrowRight, CircleAlert, HelpCircle, ShieldAlert } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';
import { usePubMedSearch, SearchStep, UsePubMedSearchResult } from '@/hooks/usePubMedSearch';
import { PaperSection } from '@/components/PaperSection';
import { useAuth } from '@/contexts/AuthContext';
import { DiseaseDescription } from '@/services/openai';
import { getPlanConfig } from '@/lib/plans';

type SearchMode = 'disease' | 'symptom';

interface SymptomDisease {
  name_ko: string;
  name_en: string;
  likelihood: '높음' | '중간' | '낮음';
  severity: '긴급' | '주의' | '관찰';
  description: string;
  matching_symptoms: string[];
  additional_symptoms: string[];
  action: string;
}

interface FollowupQuestion {
  question: string;
  type: 'yes_no' | 'select' | 'text';
  options?: string[];
}

interface SymptomResult {
  diseases: SymptomDisease[];
  followup_questions: (string | FollowupQuestion)[];
  emergency_signs: string[];
}

const stepMessages: Record<SearchStep, string> = {
  idle: '',
  validating: '검색어 확인 중...',
  searching: '논문 검색 중...',
  fetching: '논문 정보 가져오는 중...',
  analyzing: 'AI가 논문을 분석하고 있습니다...',
  done: '',
};

const severityConfig = {
  '긴급': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  '주의': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  '관찰': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', badge: 'bg-green-100 text-green-700' },
};

const likelihoodConfig = {
  '높음': 'bg-red-100 text-red-600',
  '중간': 'bg-yellow-100 text-yellow-700',
  '낮음': 'bg-gray-100 text-gray-500',
};

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialPet = (searchParams.get('pet') as 'cat' | 'dog') || 'cat';
  const initialMode = (searchParams.get('mode') as SearchMode) || 'disease';
  const { user, profile } = useAuth();
  const isPaid = profile?.plan !== 'free';
  const planConfig = getPlanConfig(profile?.plan || 'free');
  const maxSymptomLen = planConfig.maxSymptomLength;
  const storageKey = user ? `recentSearches_${user.id}` : null;

  const [cached] = useState(() => {
    if (initialQuery) return null;
    try {
      const raw = sessionStorage.getItem('searchCache');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [cachedSymptom] = useState(() => {
    if (initialQuery && initialMode === 'symptom') return null;
    try {
      const raw = sessionStorage.getItem('symptomCache');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [query, setQuery] = useState(cached?.query || initialQuery);
  const [petType, setPetType] = useState<'cat' | 'dog'>(cached?.petType || initialPet);
  const [searchTerm, setSearchTerm] = useState<string | null>(cached?.searchTerm || null);
  const [mockResult, setMockResult] = useState<Disease | null>(cached?.mockResult || null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [cachedPubmed, setCachedPubmed] = useState<{ articles: any[]; analysis: any; diseaseDescription?: DiseaseDescription | null } | null>(
    cached ? { articles: cached.articles, analysis: cached.analysis, diseaseDescription: cached.diseaseDescription } : null
  );
  const [searchKey, setSearchKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(cached?.saved || false);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [symptomUsageInfo, setSymptomUsageInfo] = useState<{ search: { used: number; limit: number }; refine: { used: number; limit: number }; plan: string } | null>(null);
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<number>>(new Set());
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [symptomResult, setSymptomResult] = useState<SymptomResult | null>(cachedSymptom?.result || null);
  const [symptomLoading, setSymptomLoading] = useState(false);
  const [symptomError, setSymptomError] = useState<string | null>(null);
  const [symptomQuery, setSymptomQuery] = useState<string | null>(cachedSymptom?.query || null);
  const [followupAnswers, setFollowupAnswers] = useState<Record<number, string>>({});
  const [isRefining, setIsRefining] = useState(false);
  const [refineLimit, setRefineLimit] = useState<string | null>(null);

  const pubmed = usePubMedSearch(cachedPubmed ? null : (searchMode === 'disease' ? searchTerm : null), petType, searchKey);

  const displayPubmed: UsePubMedSearchResult = cachedPubmed ? {
    articles: cachedPubmed.articles,
    analysis: cachedPubmed.analysis,
    loading: false,
    analysisLoading: false,
    step: 'done' as SearchStep,
    error: null,
    retry: () => { setCachedPubmed(null); },
    diseaseDescription: cachedPubmed.diseaseDescription || null,
    isCached: false,
  } : pubmed;

  // Init bookmarks for cached results
  useEffect(() => {
    if (cachedPubmed && cachedPubmed.articles.length > 0 && bookmarkedPapers.size === 0) {
      setBookmarkedPapers(new Set(cachedPubmed.articles.map((_, i) => i)));
    }
  }, [cachedPubmed]);

  // Fetch usage info on mount and after search
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/search-usage');
        if (res.ok) {
          const data = await res.json();
          setUsageInfo({ used: data.used, limit: data.limit, plan: data.plan });
        }
      } catch {}
    };
    fetchUsage();
  }, [pubmed.step]);

  // Fetch symptom usage info
  useEffect(() => {
    if (searchMode !== 'symptom') return;
    const fetchSymptomUsage = async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/symptom-usage');
        if (res.ok) {
          const data = await res.json();
          setSymptomUsageInfo(data);
        }
      } catch {}
    };
    fetchSymptomUsage();
  }, [searchMode, symptomResult, isRefining]);

  useEffect(() => {
    if (!storageKey) { setRecentSearches([]); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRecentSearches(JSON.parse(saved));
      else setRecentSearches([]);
    } catch {}
  }, [storageKey]);

  const saveHistory = (searches: string[]) => {
    setRecentSearches(searches);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(searches));
  };

  // Auto-bookmark all papers when results arrive
  useEffect(() => {
    if (pubmed.step === 'done' && pubmed.articles.length > 0) {
      setBookmarkedPapers(new Set(pubmed.articles.map((_, i) => i)));
    }
  }, [pubmed.step, pubmed.articles]);

  useEffect(() => {
    if (pubmed.step === 'done' && searchTerm && pubmed.articles.length > 0) {
      try {
        sessionStorage.setItem('searchCache', JSON.stringify({
          query, petType, searchTerm, mockResult, saved,
          articles: pubmed.articles,
          analysis: pubmed.analysis,
          diseaseDescription: pubmed.diseaseDescription,
        }));
      } catch {}
    }
  }, [pubmed.step, pubmed.articles, pubmed.analysis, pubmed.diseaseDescription, query, petType, searchTerm, mockResult, saved]);

  // Cache symptom results in sessionStorage
  useEffect(() => {
    if (symptomResult && symptomQuery) {
      try {
        sessionStorage.setItem('symptomCache', JSON.stringify({
          query: symptomQuery,
          petType,
          result: symptomResult,
        }));
      } catch {}
    }
  }, [symptomResult, symptomQuery, petType]);

  useEffect(() => {
    if (initialQuery) {
      if (!user) {
        setLoginRequired(true);
        return;
      }
      setLoginRequired(false);
      setSearchTerm(initialQuery);
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          const existing: string[] = saved ? JSON.parse(saved) : [];
          const updated = [initialQuery, ...existing.filter(s => s !== initialQuery)].slice(0, 10);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setRecentSearches(updated);
        } catch {}
      }
      if (initialMode === 'symptom') {
        setSymptomQuery(initialQuery);
        handleSymptomSearch(initialQuery);
      } else {
        const found = mockDiseases.find(d => d.name.includes(initialQuery));
        setMockResult(found || null);
      }
    }
  }, [initialQuery, user, storageKey]);

  const [loginRequired, setLoginRequired] = useState(false);

  const handleSymptomSearch = async (q: string, answers?: { question: string; answer: string }[]) => {
    const isRefine = !!answers;
    if (isRefine) {
      setIsRefining(true);
    } else {
      setSymptomLoading(true);
      setSymptomError(null);
      setSymptomResult(null);
      setFollowupAnswers({});
      setRefineLimit(null);
    }
    try {
      const { authFetch } = await import('@/lib/authFetch');

      const res = await authFetch('/api/symptom-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: q,
          petType,
          ...(isRefine ? { followupAnswers: answers } : {}),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429 && errData.limitReached) {
          if (isRefine) {
            setRefineLimit(errData.error || '재분석 횟수를 초과했습니다.');
          } else {
            setSymptomError(errData.error || '증상 검색 횟수를 초과했습니다.');
          }
        } else if (!isRefine) {
          setSymptomError('증상 분석에 실패했습니다. 다시 시도해주세요.');
        }
        return;
      }
      const data = await res.json();
      setSymptomResult(data);
      setFollowupAnswers({});
    } catch {
      if (!isRefine) setSymptomError('증상 분석에 실패했습니다.');
    } finally {
      setSymptomLoading(false);
      setIsRefining(false);
    }
  };

  const getQuestionText = (q: string | FollowupQuestion): string => {
    return typeof q === 'string' ? q : q.question;
  };

  const getQuestionType = (q: string | FollowupQuestion): 'yes_no' | 'select' | 'text' => {
    return typeof q === 'string' ? 'yes_no' : (q.type || 'yes_no');
  };

  const getQuestionOptions = (q: string | FollowupQuestion): string[] => {
    return typeof q === 'string' ? [] : (q.options || []);
  };

  const handleRefineAnalysis = () => {
    if (!symptomQuery || !symptomResult) return;
    const answers = Object.entries(followupAnswers)
      .filter(([, v]) => v.trim())
      .map(([idx, answer]) => ({
        question: getQuestionText(symptomResult.followup_questions[Number(idx)]),
        answer,
      }));
    if (answers.length === 0) return;
    handleSymptomSearch(symptomQuery, answers);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!user) {
      setLoginRequired(true);
      return;
    }
    setLoginRequired(false);
    const q = query.trim();
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10);
    saveHistory(updated);

    if (searchMode === 'symptom') {
      handleSymptomSearch(q);
      setSymptomQuery(q);
      return;
    }

    setCachedPubmed(null);
    setSaved(false);
    const found = mockDiseases.find(d => d.name.includes(query));
    setMockResult(found || null);
    setSearchTerm(q);
    setSearchKey(k => k + 1);
  };

  const deleteSearchTerm = (term: string) => {
    saveHistory(recentSearches.filter(s => s !== term));
  };

  const clickSearchTerm = (term: string) => {
    setQuery(term);
    setCachedPubmed(null);
    setSaved(false);
    const found = mockDiseases.find(d => d.name.includes(term));
    setMockResult(found || null);
    setSearchTerm(term);
    setSearchKey(k => k + 1);
  };

  const toggleBookmark = (idx: number) => {
    setBookmarkedPapers(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveAnalysis = async () => {
    if (!isPaid || saving || saved) return;
    setSaving(true);
    try {
      const { authFetch } = await import('@/lib/authFetch');

      // Build selected papers array from bookmarked papers
      const papers = Array.from(bookmarkedPapers).map(idx => {
        const article = displayPubmed.articles[idx];
        return {
          pmid: article.pmid,
          title: article.title,
          titleKo: displayPubmed.analysis?.titles?.[idx] || null,
          summary: displayPubmed.analysis?.summaries?.[idx] || null,
          journal: article.journal,
          pubDate: article.pubDate,
        };
      });

      const res = await authFetch('/api/saved-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTerm,
          petType,
          analysis: displayPubmed.analysis,
          selectedPapers: papers,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setSaved(true);
        if (result.warning) setSaveWarning(result.warning);
        try {
          const raw = sessionStorage.getItem('searchCache');
          if (raw) {
            const c = JSON.parse(raw);
            c.saved = true;
            sessionStorage.setItem('searchCache', JSON.stringify(c));
          }
        } catch {}
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  const hasSearched = searchMode === 'disease' ? searchTerm !== null : (symptomQuery !== null);
  const hasResults = displayPubmed.articles.length > 0 && displayPubmed.step === 'done';
  const desc = displayPubmed.diseaseDescription;
  const showBottomBar = hasResults && isPaid && searchMode === 'disease';

  return (
    <div className="flex flex-col h-full bg-white min-h-[calc(100vh-8rem)]">
      {/* Search Header */}
      <div className="bg-white px-4 pt-6 pb-4 sticky top-14 z-40">
        {/* Mode Toggle */}
        <div className="max-w-sm mx-auto mb-3 flex justify-center">
          <div className="flex bg-gray-100 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => { setSearchMode('disease'); setQuery(''); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                searchMode === 'disease' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <SearchIcon size={12} className="inline mr-1 -mt-0.5" />
              질병명
            </button>
            <button
              type="button"
              onClick={() => { setSearchMode('symptom'); setQuery(''); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                searchMode === 'symptom' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Stethoscope size={12} className="inline mr-1 -mt-0.5" />
              증상으로 찾기
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="max-w-sm mx-auto">
          <div className={`flex items-center rounded-full border shadow-sm hover:shadow-md transition-shadow px-1.5 py-1 ${
            searchMode === 'symptom' ? 'border-purple-200' : 'border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
              className={`h-8 rounded-full px-3 flex items-center justify-center flex-shrink-0 transition-colors text-xs font-medium ${
                searchMode === 'symptom' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {petType === 'dog' ? '강아지' : '고양이'} ⇄
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                if (searchMode === 'symptom' && e.target.value.length > maxSymptomLen) return;
                setQuery(e.target.value);
              }}
              maxLength={searchMode === 'symptom' ? maxSymptomLen : undefined}
              placeholder={searchMode === 'symptom' ? '증상을 검색하세요' : '질병명을 검색하세요'}
              className="flex-1 h-9 px-3 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            <button
              type="submit"
              className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                searchMode === 'symptom' ? 'text-gray-400 hover:text-purple-600' : 'text-gray-400 hover:text-blue-600'
              }`}
            >
              <SearchIcon size={18} />
            </button>
          </div>
        </form>
        {/* Symptom character count */}
        {searchMode === 'symptom' && query.length > 0 && (
          <div className="max-w-sm mx-auto mt-1 flex justify-end pr-2">
            <span className={`text-[10px] ${query.length >= maxSymptomLen ? 'text-red-400' : 'text-gray-400'}`}>
              {query.length}/{maxSymptomLen}자
            </span>
          </div>
        )}
        {/* Usage count badge */}
        {searchMode === 'disease' && usageInfo && (
          <div className="max-w-sm mx-auto mt-2 flex justify-center">
            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
              isPaid ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
            }`}>
              {isPaid ? (
                <><Sparkles size={10} /> Plus {usageInfo.used}/{usageInfo.limit}</>
              ) : (
                <>Free {usageInfo.used}/{usageInfo.limit}</>
              )}
            </span>
          </div>
        )}
        {searchMode === 'symptom' && symptomUsageInfo && (
          <div className="max-w-sm mx-auto mt-2 flex justify-center">
            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
              isPaid ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
            }`}>
              {isPaid ? (
                <><Sparkles size={10} /> Plus {symptomUsageInfo.search.used}/{symptomUsageInfo.search.limit}</>
              ) : (
                <>Free {symptomUsageInfo.search.used}/{symptomUsageInfo.search.limit}</>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`flex-1 px-4 pb-4 ${showBottomBar ? 'pb-20' : ''}`}>
        {/* Login required message */}
        {loginRequired && (
          <div className="max-w-sm mx-auto mt-6 text-center py-10">
            <Lock size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-600 font-medium mb-4">로그인 후 이용할 수 있습니다</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
            >
              로그인하기
            </button>
          </div>
        )}
        {/* Symptom Mode Results */}
        {searchMode === 'symptom' && !loginRequired && (symptomLoading || symptomResult || symptomError) ? (
          <div className="max-w-sm mx-auto space-y-4">
            {symptomLoading && (
              <div className="flex items-center gap-2.5 p-4 rounded-xl bg-purple-50">
                <Loader2 size={16} className="animate-spin text-purple-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">AI가 증상을 분석하고 있습니다...</p>
              </div>
            )}

            {symptomError && (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 font-medium mb-1">{symptomError}</p>
                {!isPaid && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Crown size={16} className="text-purple-500" />
                      <p className="text-sm font-bold text-gray-700">업그레이드하기</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">더 많은 검색 · 분석 보관 · 기록장 확장</p>
                    <button
                      onClick={() => window.location.href = '/profile/subscription'}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium"
                    >
                      요금제 보기
                    </button>
                  </div>
                )}
              </div>
            )}

            {symptomResult && (
              <>
                {/* Disease Cards */}
                {symptomResult.diseases.map((disease, idx) => {
                  const sev = severityConfig[disease.severity] || severityConfig['관찰'];
                  const lik = likelihoodConfig[disease.likelihood] || likelihoodConfig['낮음'];
                  return (
                    <div key={idx} className={`rounded-xl border ${sev.border} ${sev.bg} p-4 space-y-3`}>
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">
                            {disease.name_ko}
                            {disease.name_en && <span className="text-xs text-gray-400 font-normal ml-1.5">({disease.name_en})</span>}
                          </h3>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.badge}`}>
                            {disease.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${lik}`}>
                            가능성 {disease.likelihood}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-600 leading-relaxed">{disease.description}</p>

                      {/* Matching symptoms */}
                      {disease.matching_symptoms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1">일치하는 증상</p>
                          <div className="flex flex-wrap gap-1">
                            {disease.matching_symptoms.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/80 text-gray-700 rounded-full text-[11px] font-medium border border-gray-200">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Additional symptoms to watch */}
                      {disease.additional_symptoms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 mb-1">추가로 관찰할 증상</p>
                          <div className="flex flex-wrap gap-1">
                            {disease.additional_symptoms.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/50 text-gray-500 rounded-full text-[11px] border border-dashed border-gray-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action */}
                      <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2.5">
                        <ArrowRight size={14} className={`${sev.text} mt-0.5 flex-shrink-0`} />
                        <p className="text-xs text-gray-700 font-medium">{disease.action}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Emergency Signs */}
                {symptomResult.emergency_signs.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-red-600 mb-2">
                      <ShieldAlert size={14} />
                      이런 증상이면 즉시 병원으로
                    </h4>
                    <ul className="space-y-1.5">
                      {symptomResult.emergency_signs.map((sign, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                          <CircleAlert size={12} className="mt-0.5 flex-shrink-0" />
                          {sign}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interactive Follow-up Questions */}
                {symptomResult.followup_questions.length > 0 && !refineLimit && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                      <HelpCircle size={14} />
                      추가 질문에 답하면 더 정확해져요
                    </h4>
                    <div className="space-y-3">
                      {symptomResult.followup_questions.map((q, i) => {
                        const qType = getQuestionType(q);
                        const qText = getQuestionText(q);
                        const qOptions = getQuestionOptions(q);
                        return (
                          <div key={i} className="space-y-1.5">
                            <p className="text-xs text-gray-700 font-medium">{i + 1}. {qText}</p>
                            {qType === 'yes_no' && (
                              <div className="flex gap-1.5">
                                {['예', '아니오', '모르겠어요'].map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setFollowupAnswers(prev => ({ ...prev, [i]: option }))}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                                      followupAnswers[i] === option
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}
                            {qType === 'select' && qOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {qOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setFollowupAnswers(prev => ({ ...prev, [i]: option }))}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                                      followupAnswers[i] === option
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            )}
                            {qType === 'text' && (
                              <input
                                type="text"
                                value={followupAnswers[i] || ''}
                                onChange={(e) => setFollowupAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                placeholder="답변을 입력하세요"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {Object.values(followupAnswers).some(v => v.trim()) && (
                      <div className="space-y-1.5">
                        <button
                          onClick={handleRefineAnalysis}
                          disabled={isRefining}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {isRefining ? (
                            <><Loader2 size={14} className="animate-spin" /> 재분석 중...</>
                          ) : (
                            <><Stethoscope size={14} /> 답변 반영하여 재분석</>
                          )}
                        </button>
                        {symptomUsageInfo && (
                          <p className="text-[10px] text-gray-400 text-center">
                            오늘 재분석 {symptomUsageInfo.refine.used}/{symptomUsageInfo.refine.limit}회 사용
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Refine limit reached */}
                {refineLimit && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-600 font-medium">{refineLimit}</p>
                    {!isPaid && (
                      <button
                        onClick={() => window.location.href = '/profile/subscription'}
                        className="mt-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-xs font-medium"
                      >
                        요금제 보기
                      </button>
                    )}
                  </div>
                )}

                {/* Disclaimer */}
                <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
                  AI 예측은 참고용이며, 정확한 진단은 수의사와 상담하세요.
                </p>
              </>
            )}
          </div>
        ) : !hasSearched && !loginRequired ? (
          <div className="max-w-sm mx-auto mt-6">
            {user && <h3 className="text-xs font-semibold text-gray-400 mb-3">최근 검색어</h3>}
            {!user ? (
              <div className="text-center mt-10 text-gray-400">
                <p className="text-sm">{searchMode === 'symptom' ? '증상을 입력하면 AI가 가능한 질병을 예측합니다.' : '반려동물의 질병명을 검색해보세요.'}</p>
                {searchMode !== 'symptom' && <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>}
              </div>
            ) : recentSearches.length === 0 ? (
              <p className="text-sm text-gray-400">검색기록이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, idx) => (
                  <div key={idx} className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-gray-50 border border-gray-200 rounded-full">
                    <button onClick={() => clickSearchTerm(term)} className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                      {term}
                    </button>
                    <button onClick={() => deleteSearchTerm(term)} className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {user && (
              <div className="mt-10 text-center text-gray-400">
                <p className="text-sm">{searchMode === 'symptom' ? '증상을 입력하면 AI가 가능한 질병을 예측합니다.' : '반려동물의 질병명을 검색해보세요.'}</p>
                <p className="text-xs mt-1">{searchMode === 'symptom' ? '' : 'AI가 수의학 논문을 분석하여 요약해드립니다.'}</p>
              </div>
            )}
          </div>
        ) : !loginRequired && searchMode === 'disease' ? (
          <div className="max-w-sm mx-auto space-y-5">
            {displayPubmed.step !== 'idle' && displayPubmed.step !== 'done' && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50">
                <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-500">{stepMessages[displayPubmed.step]}</p>
              </div>
            )}

            {/* Disease Description Card (#3) */}
            {desc && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">
                      {desc.name_ko}
                      {desc.name_en && <span className="text-xs text-gray-400 font-normal ml-1.5">({desc.name_en})</span>}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{desc.description}</p>
                  </div>
                </div>
                {desc.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {desc.symptoms.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white text-blue-600 rounded-full text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {desc.when_to_visit && (
                  <p className="text-[11px] text-orange-600 pl-6">
                    {desc.when_to_visit}
                  </p>
                )}
                <span className="inline-block text-[10px] bg-blue-100 text-blue-500 px-2 py-0.5 rounded-full ml-6">
                  AI 생성
                </span>
              </div>
            )}

            {/* Rate limit reached */}
            {displayPubmed.limitReached ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 font-medium mb-1">{displayPubmed.error}</p>
                {!isPaid && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Crown size={16} className="text-purple-500" />
                      <p className="text-sm font-bold text-gray-700">업그레이드하기</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">더 많은 검색 · 분석 보관 · 기록장 확장</p>
                    <button
                      onClick={() => window.location.href = '/profile/subscription'}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium"
                    >
                      요금제 보기
                    </button>
                  </div>
                )}
              </div>
            ) : displayPubmed.error && displayPubmed.step === 'done' ? (
              <div className="text-center py-12">
                <AlertTriangle size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">{displayPubmed.error}</p>
              </div>
            ) : (
              <>
                {hasResults && !isPaid && (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl cursor-pointer" onClick={() => window.location.href = '/profile/subscription'}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown size={13} className="text-purple-500" />
                      <p className="text-xs font-bold text-gray-600">구독하고 더 많이 이용하기</p>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      더 많은 검색 · 분석 보관 · 기록장 확장
                    </p>
                  </div>
                )}

                <PaperSection
                  pubmed={displayPubmed}
                  diseaseName={searchTerm || ''}
                  diseaseSummary={mockResult?.summary || '관련 논문을 검색 중입니다...'}
                  bookmarkedPapers={bookmarkedPapers}
                  onToggleBookmark={toggleBookmark}
                  showBookmarks={isPaid && !saved}
                />

                {/* AI Analysis sections */}
                <div>
                  <section>
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
                      <AlertTriangle size={14} className="text-orange-400" />
                      주의사항 & 대처방법
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      {displayPubmed.analysisLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                          <Loader2 size={14} className="animate-spin" />
                          AI가 논문을 분석하고 있습니다...
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {(displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0
                            ? displayPubmed.analysis.precautions
                            : mockResult?.precautions || ['검색 결과를 분석 중입니다...']
                          ).map((item, idx) => (
                            <li key={idx} className="flex gap-2 text-sm text-gray-600 items-start">
                              <span className="text-orange-300 mt-0.5 text-xs">●</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0 && (
                        <span className="inline-block text-xs bg-green-50 text-green-500 px-2 py-0.5 rounded-full mt-3">
                          AI 논문 분석 기반
                        </span>
                      )}
                    </div>
                  </section>

                  <section className="mt-5">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
                      <Pill size={14} className="text-purple-400" />
                      도움되는 성분
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      {displayPubmed.analysisLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                          <Loader2 size={14} className="animate-spin" />
                          성분 분석 중...
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0
                            ? displayPubmed.analysis.ingredients
                            : mockResult?.ingredients || ['분석 중...']
                          ).map((item, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      {displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0 && (
                        <span className="inline-block text-xs bg-green-50 text-green-500 px-2 py-0.5 rounded-full mt-3">
                          AI 논문 분석 기반
                        </span>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Sticky Bookmark Bar */}
      {showBottomBar && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 z-30">
          {saveWarning && (
            <p className="text-xs text-orange-500 mb-2 text-center">{saveWarning}</p>
          )}
          <button
            onClick={() => setShowSaveConfirm(true)}
            disabled={saving || saved}
            className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              saved
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Bookmark size={16} />
            {saved ? '보관 완료' : saving ? `보관 중...` : bookmarkedPapers.size > 0 ? `선택한 논문 보관하기 (${bookmarkedPapers.size}편)` : '이 분석 보관하기'}
          </button>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
            <h3 className="text-sm font-bold text-gray-800 mb-2">보관 확인</h3>
            <p className="text-sm text-gray-600 mb-1">
              {bookmarkedPapers.size > 0
                ? `선택한 논문 ${bookmarkedPapers.size}편과 분석 결과를 보관합니다.`
                : '분석 결과를 보관합니다.'}
            </p>
            <p className="text-xs text-gray-400 mb-4">보관한 내용은 마이페이지 &gt; 내 보관함에서 확인할 수 있습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { setShowSaveConfirm(false); handleSaveAnalysis(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                보관하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[calc(100vh-8rem)]"><div className="text-gray-500">로딩 중...</div></div>}>
      <SearchContent />
    </Suspense>
  );
}
