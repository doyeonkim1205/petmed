'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search as SearchIcon,
  Plus,
  FileText,
  ClipboardList,
  MapPin,
  User,
  X,
  Dog,
  Cat,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import { mockDiseases } from '@/data/mock';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [petType, setPetType] = useState<'cat' | 'dog'>('dog');
  const [pets, setPets] = useState<Pet[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const { user, profile } = useAuth();

  // Fetch pets
  useEffect(() => {
    if (!user) return;
    const fetchPets = async () => {
      const { data } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data) setPets(data);
    };
    fetchPets();
  }, [user]);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
    } catch {}
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveAndNavigate(query.trim());
  };

  const saveAndNavigate = (term: string) => {
    try {
      const saved = localStorage.getItem('recentSearches');
      const existing: string[] = saved ? JSON.parse(saved) : [];
      const updated = [term, ...existing.filter(s => s !== term)].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      setRecentSearches(updated.slice(0, 5));
    } catch {}
    router.push(`/search?q=${encodeURIComponent(term)}&pet=${petType}`);
  };

  const removeRecentSearch = (term: string) => {
    try {
      const saved = localStorage.getItem('recentSearches');
      const existing: string[] = saved ? JSON.parse(saved) : [];
      const updated = existing.filter(s => s !== term);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      setRecentSearches(updated.slice(0, 5));
    } catch {}
  };

  const recommendedDiseases = mockDiseases.filter(
    d => d.type === petType || d.type === 'all'
  );

  const quickMenuItems = [
    { icon: FileText, label: '질병 검색', href: '/search', color: 'bg-blue-100 text-blue-600' },
    { icon: ClipboardList, label: '건강 기록장', href: '/records', color: 'bg-emerald-100 text-emerald-600' },
    { icon: MapPin, label: '동물병원 찾기', href: '/map', color: 'bg-rose-100 text-rose-600' },
    { icon: User, label: '마이페이지', href: '/profile', color: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 1. Hero */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-12 pb-14 text-white">
        {user && profile ? (
          <>
            <h1 className="text-2xl font-bold">안녕하세요, {profile.nickname}님 🐾</h1>
            <p className="text-blue-100 text-sm mt-1">오늘도 반려동물의 건강을 챙겨볼까요?</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">🐾 PawDex</h1>
            <p className="text-blue-100 text-sm mt-1">AI 수의학 논문 분석 서비스</p>
          </>
        )}
      </div>

      {/* 2. Search Bar */}
      <div className="-mt-6 mx-4">
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
              className={`h-12 w-12 rounded-xl flex items-center justify-center border transition-colors flex-shrink-0 ${
                petType === 'cat'
                  ? 'bg-pink-50 border-pink-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              {petType === 'cat' ? (
                <Cat size={24} className="text-pink-500" />
              ) : (
                <Dog size={24} className="text-blue-500" />
              )}
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="질병명을 검색하세요"
                className="w-full h-12 pl-4 pr-10 rounded-xl bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
              >
                <SearchIcon size={20} />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. My Pets */}
      {user && (
        <section className="mt-6 px-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">내 반려동물</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setPetType(pet.type)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium flex-shrink-0 border transition-colors ${
                  pet.type === petType
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {pet.type === 'dog' ? (
                  <Dog size={14} />
                ) : (
                  <Cat size={14} />
                )}
                {pet.name}
              </button>
            ))}
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-400 flex-shrink-0 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500 transition-colors"
            >
              <Plus size={14} />
              추가
            </button>
          </div>
        </section>
      )}

      {/* 4. Recent Searches */}
      {recentSearches.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 검색</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="flex items-center gap-1 rounded-full bg-white border border-gray-200 pl-3 pr-1.5 py-1.5 text-sm text-gray-600 flex-shrink-0"
              >
                <button
                  onClick={() => saveAndNavigate(term)}
                  className="hover:text-blue-600 transition-colors"
                >
                  {term}
                </button>
                <button
                  onClick={() => removeRecentSearch(term)}
                  className="p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Recommended Searches */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">추천 검색어</h2>
        <div className="flex flex-wrap gap-2">
          {recommendedDiseases.map((disease) => (
            <button
              key={disease.id}
              onClick={() => saveAndNavigate(disease.name)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                disease.type === 'dog'
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : disease.type === 'cat'
                  ? 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              {disease.name}
            </button>
          ))}
        </div>
      </section>

      {/* 6. Quick Menu */}
      <section className="mt-6 px-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">빠른 메뉴</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickMenuItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                <item.icon size={20} />
              </div>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 7. Tagline */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">PawDex — AI 기반 반려동물 건강 플랫폼</p>
      </div>
    </div>
  );
}
