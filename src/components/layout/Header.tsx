'use client';

import Link from 'next/link';
import { User } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
      <div className="w-10" />

      <Link href="/" className="text-xl font-bold text-blue-600 flex items-center gap-1">
        🐾 PawDex
      </Link>

      <Link href="/profile" className="p-2 -mr-2 text-gray-700">
        <User size={24} />
      </Link>
    </header>
  );
}
