'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="bg-gray-50 min-h-full p-4">
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="질병명을 검색하세요"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent outline-none"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
      </div>

      <div className="bg-white rounded-xl p-6 text-center">
        <p className="text-gray-500 mb-2">질병 정보를 검색해보세요</p>
        <p className="text-sm text-gray-400">
          반려동물의 증상이나 질병명을 입력하면<br />
          관련 정보를 찾아드립니다.
        </p>
      </div>
    </div>
  );
}
