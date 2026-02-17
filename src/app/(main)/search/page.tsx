'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, AlertTriangle, Pill, Loader2, X } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';
import { usePubMedSearch, SearchStep, UsePubMedSearchResult } from '@/hooks/usePubMedSearch';
import { PaperSection } from '@/components/PaperSection';

const stepMessages: Record<SearchStep, string> = {
  idle: '',
  translating: '검색어 번역 중...',
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

    // Add to history (deduplicate, max 10)
    const updated = [query.trim(), ...recentSearches.filter(s => s !== query.trim())].slice(0, 10);
    saveHistory(updated);

    setCachedPubmed(null); // Clear cache — use live results
    const found = mockDiseases.find(d => d.name.includes(query));
    setMockResult(found || null);
    setSearchTerm(query.trim());
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
    <div className="flex flex-col h-full bg-gray-50 min-h-[calc(100vh-8rem)]">
      {/* Search Header */}
      <div className="bg-white p-4 sticky top-14 z-40 border-b border-gray-100 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-2 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
              className={`h-12 w-12 rounded-lg flex items-center justify-center text-2xl border transition-colors ${petType === 'cat' ? 'bg-pink-50 border-pink-200' : 'bg-blue-50 border-blue-200'}`}
            >
              {petType === 'cat' ? '🐱' : '🐶'}
            </button>
            <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[10px] px-1 rounded">▼</div>
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="질병명을 입력하세요..."
              className="w-full h-12 pl-4 pr-10 rounded-lg bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              <SearchIcon size={20} />
            </button>
          </div>
        </form>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {!hasSearched ? (
          <div className="mt-4">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">최근 검색어</h3>
            {recentSearches.length === 0 ? (
              <p className="text-sm text-gray-400">검색 기록이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, idx) => (
                  <div key={idx} className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 bg-white border border-gray-200 rounded-full">
                    <button onClick={() => clickSearchTerm(term)} className="text-sm text-gray-600 hover:text-gray-900">
                      {term}
                    </button>
                    <button onClick={() => deleteSearchTerm(term)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 text-center text-gray-400">
              <p className="text-sm">반려동물의 증상이나 질병명을 검색해보세요.</p>
              <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {displayPubmed.step !== 'idle' && displayPubmed.step !== 'done' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700">{stepMessages[displayPubmed.step]}</p>
                  <p className="text-xs text-blue-400 mt-0.5">잠시만 기다려주세요</p>
                </div>
              </div>
            )}

            <PaperSection
              pubmed={displayPubmed}
              diseaseName={searchTerm || ''}
              diseaseSummary={mockResult?.summary || '관련 논문을 검색 중입니다...'}
            />

            <section className="bg-white p-5 rounded-2xl shadow-sm border border-red-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                <AlertTriangle className="text-red-500" size={20}/>
                주의사항 & 대처방법
              </h2>
              {displayPubmed.analysisLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  AI가 논문을 분석하고 있습니다...
                </div>
              ) : (
                <ul className="space-y-2">
                  {(displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0
                    ? displayPubmed.analysis.precautions
                    : mockResult?.precautions || ['검색 결과를 분석 중입니다...']
                  ).map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-gray-700 items-start">
                      <span className="text-red-400 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {displayPubmed.analysis?.precautions && displayPubmed.analysis.precautions.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">AI 논문 분석 기반</span>
                </div>
              )}
            </section>

            <section className="bg-white p-5 rounded-2xl shadow-sm border border-purple-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Pill className="text-purple-500" size={20}/>
                도움되는 성분
              </h2>
              {displayPubmed.analysisLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  성분 분석 중...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0
                    ? displayPubmed.analysis.ingredients
                    : mockResult?.ingredients || ['분석 중...']
                  ).map((item, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              )}
              {displayPubmed.analysis?.ingredients && displayPubmed.analysis.ingredients.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">AI 논문 분석 기반</span>
                </div>
              )}
            </section>
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
