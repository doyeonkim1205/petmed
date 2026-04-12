'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Search as SearchIcon, Stethoscope } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] bg-white px-4">
      {/* Logo */}
      <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-4">🐾 PawDex</h1>

      {/* Mode Toggle */}
      <div className="flex bg-gray-100 rounded-full p-0.5 mb-4">
        <button
          type="button"
          onClick={() => setSearchMode('disease')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            searchMode === 'disease' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <SearchIcon size={12} className="inline mr-1 -mt-0.5" />
          질병명
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('symptom')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            searchMode === 'symptom' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Stethoscope size={12} className="inline mr-1 -mt-0.5" />
          증상으로 찾기
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-sm mx-auto">
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
            onChange={(e) => setQuery(e.target.value)}
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

    </div>
  );
}
