'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { InstallPrompt } from '@/components/InstallPrompt';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideHeader = pathname === '/';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white shadow-sm min-h-screen flex flex-col">
        {!hideHeader && <Header />}
        <main className="flex-1 pb-16">
          {children}
        </main>
        <Footer />
        <InstallPrompt />
      </div>
    </div>
  );
}
