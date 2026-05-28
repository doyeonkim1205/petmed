'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PawPrint, Crown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectivePlan } from '@/lib/plans';
import { supabase } from '@/lib/supabase';

/**
 * 홈 하단 "스마트 배너" — 외부 광고 대신 자사 콘텐츠로 한 자리를 상황별 자동 전환.
 *
 *   1) Plus(유효 플랜) 구독자       → 숨김 (아무것도 안 보임)
 *   2) 펫 미등록 (무료)             → 프로필/펫 등록 유도
 *   3) 펫 있음 + 무료              → Plus 구독 유도
 *
 * 판단 전(로딩/펫 수 미확정)엔 렌더하지 않아 깜빡임을 막는다.
 * null 반환 시 마진도 함께 사라지도록 루트 요소에 mx/mt 를 둔다.
 */
export function SmartBanner() {
  const { user, profile, loading } = useAuth();
  const [petCount, setPetCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setPetCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('pets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled) setPetCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // 판단에 필요한 정보가 다 모이기 전엔 표시하지 않음 (깜빡임 방지)
  if (loading || !user || !profile || petCount === null) return null;

  // Plus 구독자에겐 숨김
  if (getEffectivePlan(profile.plan) === 'plus') return null;

  // 펫 미등록 → 프로필 등록 유도
  if (petCount === 0) {
    return (
      <Link
        href="/profile"
        className="flex items-center gap-3 rounded-2xl p-4 mx-4 mt-4 bg-white shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
      >
        <span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <PawPrint size={20} className="text-blue-600" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-gray-900">프로필 등록하고 맞춤 케어 시작하기</span>
          <span className="block text-xs text-gray-500 mt-0.5">반려동물을 등록하면 더 정확한 분석을 받아요</span>
        </span>
        <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
      </Link>
    );
  }

  // 펫 있음 + 무료 → Plus 유도
  return (
    <Link
      href="/profile/subscription"
      className="flex items-center gap-3 rounded-2xl p-4 mx-4 mt-4 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm active:scale-[0.99] transition-transform"
    >
      <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
        <Crown size={20} className="text-amber-300" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold">PawDex Plus로 더 똑똑하게</span>
        <span className="block text-xs text-white/85 mt-0.5">증상·사진 분석을 매일 넉넉하게</span>
      </span>
      <ChevronRight size={18} className="text-white/70 flex-shrink-0" />
    </Link>
  );
}
