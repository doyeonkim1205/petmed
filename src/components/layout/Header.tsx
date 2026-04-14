'use client';

import Link from 'next/link';
import { PawIcon } from '@/components/icons/PawIcon';

export function Header() {
  return (
    <header className="sticky top-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-center px-4">
      <Link href="/" className="text-xl font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-0.5">
        <PawIcon size={22} />
        PawDex
      </Link>
    </header>
  );
}
