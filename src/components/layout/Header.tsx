'use client';

import Link from 'next/link';
import { PawIcon } from '@/components/icons/PawIcon';

export function Header() {
  return (
    <header className="sticky top-0 h-12 bg-white border-b border-gray-200 z-50 flex items-center justify-center px-4">
      <Link href="/" className="text-lg font-extrabold text-blue-600 flex items-center gap-1">
        <PawIcon size={18} className="text-blue-800 dark:text-blue-300" />
        PawDex
      </Link>
    </header>
  );
}
