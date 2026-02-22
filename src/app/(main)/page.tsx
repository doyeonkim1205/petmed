'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [petType, setPetType] = useState<'cat' | 'dog'>('dog');
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
    router.push(`/search?q=${encodeURIComponent(query.trim())}&pet=${petType}`);
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] bg-white px-4">
      {/* Logo */}
      <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">🐾 PawDex</h1>

      {/* Subtitle */}
      <p className="text-sm text-gray-400 mt-2 mb-6">AI 수의학 논문 분석 서비스</p>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-sm mx-auto">
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
  );
}
