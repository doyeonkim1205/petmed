'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search as SearchIcon,
  Plus,
  X,
  Dog,
  Cat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';

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

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] bg-white px-4">
      {/* Animal Character Animation */}
      <div className="mb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={petType}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
            onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
            className="cursor-pointer select-none"
          >
            <motion.div
              animate={{
                x: [-8, 8, -8],
                y: [0, -6, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {petType === 'dog' ? (
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  {/* Floppy ears */}
                  <ellipse cx="22" cy="38" rx="14" ry="20" fill="#C4956A" transform="rotate(-15 22 38)" />
                  <ellipse cx="22" cy="38" rx="10" ry="16" fill="#E8C5A0" transform="rotate(-15 22 38)" />
                  <ellipse cx="78" cy="38" rx="14" ry="20" fill="#C4956A" transform="rotate(15 78 38)" />
                  <ellipse cx="78" cy="38" rx="10" ry="16" fill="#E8C5A0" transform="rotate(15 78 38)" />
                  {/* Face */}
                  <circle cx="50" cy="52" r="32" fill="#F5DEB3" />
                  {/* Eyes */}
                  <circle cx="38" cy="48" r="5" fill="#3B2F2F" />
                  <circle cx="62" cy="48" r="5" fill="#3B2F2F" />
                  <circle cx="40" cy="46" r="2" fill="white" />
                  <circle cx="64" cy="46" r="2" fill="white" />
                  {/* Nose */}
                  <ellipse cx="50" cy="58" rx="5" ry="4" fill="#3B2F2F" />
                  <ellipse cx="50" cy="57" rx="2" ry="1" fill="#6B5B5B" />
                  {/* Mouth */}
                  <path d="M46 62 Q50 67 54 62" stroke="#3B2F2F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  {/* Tongue */}
                  <ellipse cx="50" cy="67" rx="3" ry="4" fill="#FF8B8B" />
                  {/* Cheeks */}
                  <circle cx="30" cy="58" r="5" fill="#FFD6D6" opacity="0.5" />
                  <circle cx="70" cy="58" r="5" fill="#FFD6D6" opacity="0.5" />
                </svg>
              ) : (
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  {/* Pointed ears */}
                  <polygon points="22,18 14,48 36,42" fill="#B0B0B0" />
                  <polygon points="24,24 18,44 34,40" fill="#E8E0E0" />
                  <polygon points="78,18 86,48 64,42" fill="#B0B0B0" />
                  <polygon points="76,24 82,44 66,40" fill="#E8E0E0" />
                  {/* Inner ear pink */}
                  <polygon points="24,26 20,40 32,38" fill="#FFB6C1" opacity="0.6" />
                  <polygon points="76,26 80,40 68,38" fill="#FFB6C1" opacity="0.6" />
                  {/* Face */}
                  <circle cx="50" cy="55" r="30" fill="#E8E0E0" />
                  {/* Eyes */}
                  <ellipse cx="38" cy="50" rx="4.5" ry="5.5" fill="#3B2F2F" />
                  <ellipse cx="62" cy="50" rx="4.5" ry="5.5" fill="#3B2F2F" />
                  <circle cx="40" cy="48" r="2" fill="white" />
                  <circle cx="64" cy="48" r="2" fill="white" />
                  {/* Nose */}
                  <polygon points="50,57 47,60 53,60" fill="#FFB6C1" />
                  {/* Mouth */}
                  <path d="M45 63 Q50 67 55 63" stroke="#3B2F2F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M50 60 L50 63" stroke="#3B2F2F" strokeWidth="1.2" strokeLinecap="round" />
                  {/* Whiskers */}
                  <line x1="12" y1="56" x2="32" y2="58" stroke="#C0C0C0" strokeWidth="1" strokeLinecap="round" />
                  <line x1="12" y1="62" x2="32" y2="62" stroke="#C0C0C0" strokeWidth="1" strokeLinecap="round" />
                  <line x1="88" y1="56" x2="68" y2="58" stroke="#C0C0C0" strokeWidth="1" strokeLinecap="round" />
                  <line x1="88" y1="62" x2="68" y2="62" stroke="#C0C0C0" strokeWidth="1" strokeLinecap="round" />
                  {/* Cheeks */}
                  <circle cx="30" cy="62" r="5" fill="#FFD6D6" opacity="0.4" />
                  <circle cx="70" cy="62" r="5" fill="#FFD6D6" opacity="0.4" />
                </svg>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-gray-400 mt-1 mb-6">AI 수의학 논문 분석 서비스</p>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-sm mx-auto">
        <div className="flex items-center rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow px-1.5 py-1">
          <button
            type="button"
            onClick={() => setPetType(petType === 'cat' ? 'dog' : 'cat')}
            className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              petType === 'cat'
                ? 'bg-pink-50 text-pink-500'
                : 'bg-blue-50 text-blue-500'
            }`}
          >
            {petType === 'cat' ? <Cat size={18} /> : <Dog size={18} />}
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

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="mt-4 w-full max-w-sm">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 justify-center flex-wrap">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 pl-3 pr-1.5 py-1 text-xs text-gray-500 flex-shrink-0"
              >
                <button
                  onClick={() => saveAndNavigate(term)}
                  className="hover:text-blue-600 transition-colors"
                >
                  {term}
                </button>
                <button
                  onClick={() => removeRecentSearch(term)}
                  className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Pets */}
      {user && (
        <div className="mt-3 w-full max-w-sm">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 justify-center flex-wrap">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setPetType(pet.type)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium flex-shrink-0 border transition-colors ${
                  pet.type === petType
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                {pet.type === 'dog' ? <Dog size={12} /> : <Cat size={12} />}
                {pet.name}
              </button>
            ))}
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-gray-400 flex-shrink-0 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500 transition-colors"
            >
              <Plus size={12} />
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
