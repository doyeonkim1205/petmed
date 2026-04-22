'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Search as SearchIcon, Stethoscope } from 'lucide-react';
import { PawIcon } from '@/components/icons/PawIcon';
import { SamsungBrowserHint } from '@/components/SamsungBrowserHint';
import { TrialBanner } from '@/components/TrialBanner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type SearchMode = 'disease' | 'symptom';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [petType, setPetType] = useState<'cat' | 'dog'>('dog');
  const [searchMode, setSearchMode] = useState<SearchMode>('disease');
  const router = useRouter();
  const { user } = useAuth();

  // Fetch pets to set initial petType
  useEffect(() => {
    if (!user) return;
    const fetchPets = async () => {
      const { data } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) setPetType(data[0].type);
    };
    fetchPets();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}&pet=${petType}&mode=${searchMode}`);
  };


  return (
    <div className="flex flex-col bg-white min-h-[calc(100vh-8rem)]">
      {/* 트라이얼 안내 카드 — 하루 1번 */}
      <TrialBanner />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <SamsungBrowserHint />
        {/* Logo */}
        <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-4 flex items-center gap-2">
          <PawIcon size={32} className="text-blue-800 dark:text-blue-300" />
          PawDex
        </h1>

      {/* Mode Toggle */}
      <div className="flex bg-gray-100 rounded-full p-0.5 mb-4">
        <button
          type="button"
          onClick={() => { setSearchMode('disease'); setQuery(''); }}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            searchMode === 'disease' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <SearchIcon size={12} className="inline mr-1 -mt-0.5" />
          논문 검색
        </button>
        <button
          type="button"
          onClick={() => { setSearchMode('symptom'); setQuery(''); }}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            searchMode === 'symptom' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Stethoscope size={12} className="inline mr-1 -mt-0.5" />
          증상 분석
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-sm mx-auto">
        <div className={`flex items-center rounded-full border shadow-sm hover:shadow-md transition-shadow px-1.5 py-1 ${
          searchMode === 'symptom' ? 'border-purple-200' : 'border-blue-300'
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
          {/* input 과 돋보기 버튼을 한 묶음으로. min-w-0 가 input intrinsic min-width
              를 풀어줘서 폰트 크기 확대 시에도 submit 버튼이 바깥으로 밀리지 않음. */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'symptom' ? '증상을 검색하세요' : '질병명을 검색하세요'}
              className="w-full h-9 pl-3 pr-10 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            <button
              type="submit"
              aria-label="검색"
              className={`absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                searchMode === 'symptom' ? 'text-gray-400 hover:text-purple-600' : 'text-gray-400 hover:text-blue-600'
              }`}
            >
              <SearchIcon size={18} />
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
