'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      // getUser() 는 토큰을 검증·자동 갱신한다. 기존엔 getSession() 의 access_token 을
      //   수동 클라에 그대로 박아, 토큰 만료 상태로 재진입 시 role 조회가 실패해
      //   관리자가 홈으로 튕기는 문제가 있었음. 자동갱신 supabase 싱글톤으로 조회.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.replace('/');
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading || !authorized) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
