import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="pt-14 pb-16 min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
}
