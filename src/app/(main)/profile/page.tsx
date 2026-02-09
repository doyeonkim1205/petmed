'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings, Bell, LogOut, ChevronRight, Gift, Edit2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <User size={40} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-500 text-center mb-6">
          PetMed의 모든 기능을 이용하려면<br />로그인해주세요.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push('/register')}
            className="flex-1 h-12 border border-gray-300 rounded-lg font-medium"
          >
            회원가입
          </button>
          <button
            onClick={() => router.push('/login')}
            className="flex-1 h-12 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-medium"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-8rem)]">
      <div className="bg-white p-6 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[#7C3AED]/10 rounded-full flex items-center justify-center text-[#7C3AED]">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {profile?.nickname || '사용자'} 님
            </h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600">
            <Edit2 size={20} />
          </button>
        </div>

        <div className="bg-[#7C3AED]/5 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-[#7C3AED] font-bold mb-1">나의 반려동물</p>
            <p className="text-sm text-gray-500">아직 등록된 반려동물이 없습니다.</p>
          </div>
          <button className="text-xs bg-white border border-[#7C3AED]/30 text-[#7C3AED] px-3 py-1.5 rounded-lg font-medium hover:bg-[#7C3AED]/5">
            등록하기
          </button>
        </div>
      </div>

      <div className="bg-white border-t border-b border-gray-100 mb-2">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3 text-gray-700">
            <Bell size={20} />
            <span>알림 설정</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </div>
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3 text-gray-700">
            <Gift size={20} />
            <span>이벤트 / 쿠폰함</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>

      <div className="bg-white border-t border-b border-gray-100">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3 text-gray-700">
            <Settings size={20} />
            <span>앱 설정</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </div>
        <button
          onClick={handleLogout}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-red-500"
        >
          <div className="flex items-center gap-3">
            <LogOut size={20} />
            <span>로그아웃</span>
          </div>
        </button>
      </div>

      <div className="p-6 text-center text-xs text-gray-400">
        <p>PetMed v1.0.0</p>
        <p className="mt-1">문의: help@petmed.com</p>
      </div>
    </div>
  );
}
