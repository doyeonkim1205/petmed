'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, AlertTriangle, Pill, Loader2, X, Lock, Bookmark, Crown, Sparkles, Info } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';
import { usePubMedSearch, SearchStep, UsePubMedSearchResult } from '@/hooks/usePubMedSearch';
import { PaperSection } from '@/components/PaperSection';
import { useAuth } from '@/contexts/AuthContext';
import { DiseaseDescription } from '@/services/openai';

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
  const { user, profile } = useAuth();
  const isPaid = profile?.plan === 'basic' || profile?.plan === 'premium';
  const isPremium = profile?.plan === 'premium';
  const storageKey = user ? `recentSearches_${user.id}` : null;

  const [cached] = useState(() => {
    if (initialQuery) return null;
    try {
      const raw = sessionStorage.getItem('searchCache');
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
  const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<number>>(new Set());
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const pubmed = usePubMedSearch(cachedPubmed ? null : searchTerm, petType, searchKey);

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

  useEffect(() => {
    if (initialQuery) {
      if (!user) {
        setLoginRequired(true);
        return;
      }
      setLoginRequired(false);
      setSearchTerm(initialQuery);
      const found = mockDiseases.find(d => d.name.includes(initialQuery));
      setMockResult(found || null);
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          const existing: string[] = saved ? JSON.parse(saved) : [];
          const updated = [initialQuery, ...existing.filter(s => s !== initialQuery)].slice(0, 10);
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setRecentSearches(updated);
        } catch {}
      }
    }
  }, [initialQuery, user, storageKey]);

  const [loginRequired, setLoginRequired] = useState(false);

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

  const hasSearched = searchTerm !== null;
  const hasResults = displayPubmed.articles.length > 0 && displayPubmed.step === 'done';
  const desc = displayPubmed.diseaseDescription;
  const showBottomBar = hasResults && isPaid;

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
              {petType === 'dog' ? '🐶 강아지' : '🐱 고양이'} ⇄
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
        {/* Usage count badge */}
        {usageInfo && (
          <div className="max-w-sm mx-auto mt-2 flex justify-center">
            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
              isPremium ? 'bg-purple-50 text-purple-500' : isPaid ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400'
            }`}>
              {isPremium ? (
                <><Crown size={10} /> Premium {usageInfo.used}/{usageInfo.limit}</>
              ) : isPaid ? (
                <><Sparkles size={10} /> Basic {usageInfo.used}/{usageInfo.limit}</>
              ) : (
                <>Free {usageInfo.used}/{usageInfo.limit}</>
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
            <p className="text-sm text-gray-600 font-medium mb-1">로그인 후 이용할 수 있습니다</p>
            <p className="text-xs text-gray-400 mb-4">AI 논문 검색은 로그인이 필요합니다</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium"
            >
              로그인하기
            </button>
          </div>
        )}
        {!hasSearched && !loginRequired ? (
          <div className="max-w-sm mx-auto mt-6">
            {user && <h3 className="text-xs font-semibold text-gray-400 mb-3">최근 검색어</h3>}
            {!user ? (
              <div className="text-center mt-10 text-gray-400">
                <p className="text-sm">반려동물의 증상이나 질병명을 검색해보세요.</p>
                <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>
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
                <p className="text-sm">반려동물의 증상이나 질병명을 검색해보세요.</p>
                <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>
              </div>
            )}
          </div>
        ) : !loginRequired ? (
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
                    <p className="text-xs text-gray-500 mb-3">더 많은 검색 + AI 분석 전체 열람 + 보관하기</p>
                    <button
                      onClick={() => window.location.href = '/pricing'}
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
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl cursor-pointer" onClick={() => window.location.href = '/pricing'}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown size={13} className="text-purple-500" />
                      <p className="text-xs font-bold text-gray-600">구독하고 모든 기능 이용하기</p>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      AI 분석 전체 열람 · 주의사항/성분 확인 · 보관하기 · 더 많은 검색
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

                {/* AI Analysis sections — blur for free users */}
                <div className="relative">
                  {!isPaid && hasResults && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                      <Lock size={28} className="text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-600 mb-1">AI 분석은 유료 플랜 전용</p>
                      <p className="text-xs text-gray-400 mb-3">주의사항, 성분 분석을 확인하세요</p>
                      <button
                        onClick={() => window.location.href = '/pricing'}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-xs font-medium"
                      >
                        요금제 보기
                      </button>
                    </div>
                  )}

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
            onClick={handleSaveAnalysis}
            disabled={saving || saved}
            className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              saved
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Bookmark size={16} />
            {saved ? '보관 완료' : saving ? `보관하기 (${bookmarkedPapers.size}편)` : '이 분석 보관하기'}
          </button>
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
