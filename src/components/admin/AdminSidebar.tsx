'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, Search, Activity, HardDrive, ArrowLeft } from 'lucide-react';

const menuItems = [
  { href: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/users', label: '사용자 관리', icon: Users },
  { href: '/admin/subscriptions', label: '구독/결제', icon: CreditCard },
  { href: '/admin/search-logs', label: '검색 로그', icon: Search },
  { href: '/admin/activity-logs', label: '활동 로그', icon: Activity },
  { href: '/admin/storage', label: '저장소 관리', icon: HardDrive },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-gray-100 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">PawDex Admin</h1>
      </div>
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-gray-700 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
