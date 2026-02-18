'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [petType, setPetType] = useState<'cat' | 'dog'>('cat');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Save to recent searches before navigating
    try {
      const saved = localStorage.getItem('recentSearches');
      const existing: string[] = saved ? JSON.parse(saved) : [];
      const updated = [query.trim(), ...existing.filter(s => s !== query.trim())].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch {}

    router.push(`/search?q=${encodeURIComponent(query.trim())}&pet=${petType}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] bg-white px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-blue-600 mb-2">
          🐾 PawDex
        </h1>
        <p className="text-sm text-gray-500">
          AI가 수의학 논문을 분석하여 알려드립니다
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="w-full max-w-sm">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
            className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl border transition-colors flex-shrink-0 ${
              petType === 'cat'
                ? 'bg-pink-50 border-pink-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            {petType === 'cat' ? '🐱' : '🐶'}
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
  );
}
