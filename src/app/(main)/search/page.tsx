'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, PlayCircle, AlertTriangle, Pill, ShoppingCart, Image as ImageIcon, FileText } from 'lucide-react';
import { mockDiseases, Disease } from '@/data/mock';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [petType, setPetType] = useState<'cat' | 'dog'>('cat');
  const [result, setResult] = useState<Disease | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(['소화기 림프종', '슬개골 탈구', '신부전']);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (!recentSearches.includes(query)) {
       setRecentSearches([query, ...recentSearches].slice(0, 10));
    }

    const found = mockDiseases.find(d => d.name.includes(query));
    setResult(found || null);
  };

  useEffect(() => {
    if (initialQuery) {
        const found = mockDiseases.find(d => d.name.includes(initialQuery));
        setResult(found || null);
    }
  }, [initialQuery]);

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
        {!result ? (
            <div className="mt-4">
               <h3 className="font-bold text-gray-700 mb-3 text-sm">최근 검색어</h3>
               <div className="flex flex-wrap gap-2">
                 {recentSearches.map((term, idx) => (
                    <button
                        key={idx}
                        onClick={() => { setQuery(term); const found = mockDiseases.find(d => d.name.includes(term)); setResult(found || null); }}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50"
                    >
                        {term}
                    </button>
                 ))}
               </div>

               <div className="mt-8 text-center text-gray-400">
                  <p className="text-sm">반려동물의 증상이나 질병명을 검색해보세요.</p>
                  <p className="text-xs mt-1">AI가 논문을 분석하여 요약해드립니다.</p>
               </div>
            </div>
        ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* 1. Paper Summary */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                     <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="text-blue-500" size={20}/>
                        논문 요약
                     </h2>
                     <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                        원본 논문 보기
                     </button>
                  </div>
                  <div className="space-y-2">
                     <h3 className="font-bold text-lg text-gray-800">{result.name}</h3>
                     <p className="text-gray-600 text-sm leading-relaxed">{result.summary}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">최신 논문 반영</span>
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">신뢰도 높음</span>
                  </div>
               </section>

               {/* 2. Precautions */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-red-50">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <AlertTriangle className="text-red-500" size={20}/>
                     주의사항 & 대처방법
                  </h2>
                  <ul className="space-y-2">
                     {result.precautions.map((item, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-gray-700 items-start">
                           <span className="text-red-400 mt-1">•</span>
                           {item}
                        </li>
                     ))}
                  </ul>
               </section>

               {/* 3. Helpful Ingredients */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-purple-50">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <Pill className="text-purple-500" size={20}/>
                     도움되는 성분
                  </h2>
                  <div className="flex flex-wrap gap-2">
                     {result.ingredients.map((item, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                           {item}
                        </span>
                     ))}
                  </div>
               </section>

               {/* 4. Recommended Products */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-orange-50">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <ShoppingCart className="text-orange-500" size={20}/>
                     추천 제품/식품
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                     {result.products.length > 0 ? result.products.map((prod) => (
                        <div key={prod.id} className="flex-shrink-0 w-32 group cursor-pointer">
                           <div className="w-32 h-32 rounded-lg bg-gray-100 overflow-hidden mb-2 relative">
                              <img src={prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                           </div>
                           <p className="text-xs font-medium text-gray-800 line-clamp-2">{prod.name}</p>
                           <p className="text-xs font-bold text-blue-600 mt-1">{prod.price}</p>
                        </div>
                     )) : (
                        <p className="text-sm text-gray-400">추천 제품 데이터가 없습니다.</p>
                     )}
                  </div>
               </section>

               {/* 5. Youtube */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <PlayCircle className="text-red-600" size={20}/>
                     관련 유튜브 영상
                  </h2>
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white relative overflow-hidden group cursor-pointer">
                      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                          <span className="text-sm text-gray-400">Video Placeholder ({result.youtubeId})</span>
                      </div>
                      <PlayCircle size={48} className="relative z-10 opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
               </section>

               {/* 6. Images */}
               <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <ImageIcon className="text-green-600" size={20}/>
                     관련 이미지
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                     {result.images.map((img, idx) => (
                        <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                           <img src={img} alt="Related" className="w-full h-full object-cover" />
                        </div>
                     ))}
                  </div>
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
