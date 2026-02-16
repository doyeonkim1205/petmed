'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, User, X, Search, ClipboardList, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { user, profile } = useAuth();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuItems = [
    { icon: Search, label: '질병 검색', path: '/search' },
    { icon: ClipboardList, label: '건강 기록장', path: '/records' },
    { icon: MapIcon, label: '동물병원 지도', path: '/map' },
    { icon: User, label: '마이페이지', path: '/profile' },
  ];

  return (
    <>
      <header className="sticky top-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <button onClick={toggleMenu} className="p-2 -ml-2 text-gray-700">
          <Menu size={24} />
        </button>

        <Link href="/" className="text-xl font-bold text-blue-600 flex items-center gap-1">
          🐾 PetMed
        </Link>

        <Link href="/profile" className="p-2 -mr-2 text-gray-700">
          <User size={24} />
        </Link>
      </header>

      {/* Mobile Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={toggleMenu}
              className="fixed inset-0 bg-black z-[60]"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white z-[60] shadow-xl flex flex-col"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
                <span className="font-bold text-lg text-blue-600">Menu</span>
                <button onClick={toggleMenu} className="p-2 text-gray-500">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <nav className="flex flex-col">
                  {menuItems.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={toggleMenu}
                      className="flex items-center gap-3 px-6 py-4 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    >
                      <item.icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {profile?.nickname?.[0] || (user ? 'U' : 'G')}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{profile?.nickname || (user ? '사용자' : '게스트')}</p>
                    <p className="text-xs text-gray-500">{user?.email || '로그인해주세요'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { toggleMenu(); router.push('/profile'); }}
                  className="w-full mt-2 py-2 px-4 bg-white border border-gray-300 rounded text-sm text-gray-600 font-medium"
                >
                  계정 관리
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
