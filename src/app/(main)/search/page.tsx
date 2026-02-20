'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, AlertTriangle, Pill, Loader2, X } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';
import { usePubMedSearch, SearchStep, UsePubMedSearchResult } from '@/hooks/usePubMedSearch';
import { PaperSection } from '@/components/PaperSection';

const stepMessages: Record<SearchStep, string> = {
  idle: '',
  validating: '검색어 확인 중...',
  searching: '논문 검색 중...',
  fetching: '논문 정보 가져오는 중...',
  analyzing: 'AI가 논문을 분석하고 있습니다...',
  done: '',
};

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialPet = (searchParams.get('pet') as 'cat' | 'dog') || 'cat';

  // Restore cached search state from sessionStorage (when returning via tab navigation)
  const [cached] = useState(() => {
    if (initialQuery) return null; // URL params take priority
    try {
      const raw = sessionStorage.getItem('searchCache');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [query, setQuery] = useState(cached?.query || initialQuery);
  const [petType, setPetType] = useState<'cat' | 'dog'>(cached?.petType || initialPet);
  const [searchTerm, setSearchTerm] = useState<string | null>(cached?.searchTerm || initialQuery || null);
  const [mockResult, setMockResult] = useState<Disease | null>(cached?.mockResult || null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // Cached pubmed results to avoid re-fetching when returning to this tab
  const [cachedPubmed, setCachedPubmed] = useState<{ articles: any[]; analysis: any } | null>(
    cached ? { articles: cached.articles, analysis: cached.analysis } : null
  );

  // Load real search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  }, []);

  // searchKey: changes every time user triggers a search, forces usePubMedSearch to re-run
  const [searchKey, setSearchKey] = useState(0);
  // Pass null to hook when using cached results (prevents re-fetching)
  const pubmed = usePubMedSearch(cachedPubmed ? null : searchTerm, petType, searchKey);

  // Merge cached or live results into a single display object
  const displayPubmed: UsePubMedSearchResult = cachedPubmed ? {
    articles: cachedPubmed.articles,
    analysis: cachedPubmed.analysis,
    loading: false,
    analysisLoading: false,
    step: 'done' as SearchStep,
    error: null,
    retry: () => { setCachedPubmed(null); },
  } : pubmed;

  const saveHistory = (searches: string[]) => {
    setRecentSearches(searches);
    localStorage.setItem('recentSearches', JSON.stringify(searches));
  };

  // Save search results to sessionStorage when search completes
  useEffect(() => {
    if (pubmed.step === 'done' && searchTerm && pubmed.articles.length > 0) {
      try {
        sessionStorage.setItem('searchCache', JSON.stringify({
          query, petType, searchTerm, mockResult,
          articles: pubmed.articles,
          analysis: pubmed.analysis,
        }));
      } catch {}
    }
  }, [pubmed.step, pubmed.articles, pubmed.analysis, query, petType, searchTerm, mockResult]);

  // Save initialQuery (from main page) to recent searches
  useEffect(() => {
    if (initialQuery) {
      const found = mockDiseases.find(d => d.name.includes(initialQuery));
      setMockResult(found || null);

      // Save to recent searches in localStorage
      try {
        const saved = localStorage.getItem('recentSearches');
        const existing: string[] = saved ? JSON.parse(saved) : [];
        const updated = [initialQuery, ...existing.filter(s => s !== initialQuery)].slice(0, 10);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        setRecentSearches(updated);
      } catch {}
    }
  }, [initialQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const q = query.trim();

    // Add to history (deduplicate, max 10)
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10);
    saveHistory(updated);

    setCachedPubmed(null); // Clear cache — use live results
    const found = mockDiseases.find(d => d.name.includes(query));
    setMockResult(found || null);
    setSearchTerm(q);
    setSearchKey(k => k + 1); // force re-search even if same term
  };

  const deleteSearchTerm = (term: string) => {
    saveHistory(recentSearches.filter(s => s !== term));
  };

  const clickSearchTerm = (term: string) => {
    setQuery(term);
    setCachedPubmed(null); // Clear cache — use live results
    const found = mockDiseases.find(d => d.name.includes(term));
    setMockResult(found || null);
    setSearchTerm(term);
    setSearchKey(k => k + 1);
  };

  const hasSearched = searchTerm !== null;

  return (
    <div className="flex flex-col h-full bg-white min-h-[calc(100vh-8rem)]">
      {/* Search Header */}
      <div className="bg-white px-4 pt-6 pb-4 sticky top-14 z-40">
        <form onSubmit={handleSearch} className="max-w-sm mx-auto">
          <div className="flex items-center rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow px-1.5 py-1">
            <button
              type="button"
              onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
              className="h-8 rounded-full px-3 flex items-center justify-center flex-shrink-0 transition-colors bg-blue-50 text-blue-600 text-xs font-medium"
            >
              {petType === 'dog' ? '강아지' : '고양이'}
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="질병명을 검색하세요"
              className="flex-1 h-9 px-3 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            <button
              type="submit"
              className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <SearchIcon size={18} />
            </button>
          </div>
        </form>
      </div>

      {/* Content Area */}
      <div className="flex-1 px-4 pb-4">
        {!hasSearched ? (
          <div className="max-w-sm mx-auto mt-6">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">최근 검색어</h3>
            {recentSearches.length === 0 ? (
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

            <div className="mt-10 text-center text-gray-400">
              <p className="text-sm">반려동물의 증상이나 질병명을 검색해보세요.</p>
              <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>
            </div>
          </div>
        ) : (
          <div className="max-w-sm mx-auto space-y-5">
            {displayPubmed.step !== 'idle' && displayPubmed.step !== 'done' && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50">
                <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-500">{stepMessages[displayPubmed.step]}</p>
              </div>
            )}

            {displayPubmed.error && displayPubmed.step === 'done' ? (
              <div className="text-center py-12">
                <AlertTriangle size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-1">{displayPubmed.error}</p>
                <p className="text-xs text-gray-300">예: 구토, 슬개골 탈구, 피부염, 기침, 설사</p>
              </div>
            ) : (
              <>
                <PaperSection
                  pubmed={displayPubmed}
                  diseaseName={searchTerm || ''}
                  diseaseSummary={mockResult?.summary || '관련 논문을 검색 중입니다...'}
                />

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

                <section>
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
              </>
            )}
          </div>
        )}
      </div>
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
