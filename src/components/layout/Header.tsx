'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-center px-4">
      <Link href="/" className="text-xl font-extrabold text-blue-600 flex items-center gap-1">
        🐾 PawDex
      </Link>
    </header>
  );
}
