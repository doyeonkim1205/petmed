
import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-14 pb-16 w-full max-w-md mx-auto bg-white shadow-sm min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  );
};
