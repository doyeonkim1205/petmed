'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, ClipboardList, Home, MapPin, User } from 'lucide-react';

type NavItem = {
  icon: React.ComponentType<{ size?: number }>;
  labelKey: 'search' | 'records' | 'home' | 'hospitals' | 'profile';
  path: string;
  color: string;
  activeColor: string;
};

export function Footer() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  // 홈은 가운데(기록장↔병원찾기 사이). 다른 탭과 동일하게 선택 시에만 강조.
  const navItems: NavItem[] = [
    { icon: FileText, labelKey: 'search', path: '/search', color: 'bg-blue-100 text-blue-600', activeColor: 'bg-blue-600 text-white' },
    { icon: ClipboardList, labelKey: 'records', path: '/records', color: 'bg-emerald-100 text-emerald-600', activeColor: 'bg-emerald-600 text-white' },
    { icon: Home, labelKey: 'home', path: '/', color: 'bg-indigo-100 text-indigo-600', activeColor: 'bg-indigo-600 text-white' },
    { icon: MapPin, labelKey: 'hospitals', path: '/map', color: 'bg-rose-100 text-rose-600', activeColor: 'bg-rose-600 text-white' },
    { icon: User, labelKey: 'profile', path: '/profile', color: 'bg-amber-100 text-amber-600', activeColor: 'bg-amber-600 text-white' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] h-18 flex items-center justify-around z-50 safe-area-bottom px-2 py-2 keyboard-hide-on-open">
      {navItems.map((item) => {
        const isActive = pathname === item.path ||
          (item.path !== '/' && pathname.startsWith(item.path));
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            className="flex flex-col items-center justify-center gap-1 w-full"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isActive ? item.activeColor : item.color
            }`}>
              <Icon size={20} />
            </div>
            <span className={`text-[10px] ${
              isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-500'
            }`}>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
