'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, FileText, Map as MapIcon, User } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: '홈', path: '/' },
    { icon: Search, label: '검색', path: '/search' },
    { icon: FileText, label: '게시판', path: '/community' },
    { icon: MapIcon, label: '맵', path: '/map' },
    { icon: User, label: '계정', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-center justify-around z-50 safe-area-bottom">
      {navItems.map((item) => {
        const isActive = pathname === item.path ||
          (item.path !== '/' && pathname.startsWith(item.path));
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-[#7C3AED]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
