'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageCircle, Camera, FileSearch, Bookmark,
  ClipboardList, Calendar, Scale, Wallet,
  ChevronRight, ChevronDown, Dog, Cat, Plus, Stethoscope, LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import { HomeBanner } from '@/components/home/HomeBanner';
import { TrialBanner } from '@/components/TrialBanner';
import { SamsungBrowserHint } from '@/components/SamsungBrowserHint';

/** birth_date(YYYY-MM-DD) → "N살" (만나이). 없거나 0살이면 null/'1살 미만'. */
function calcAge(birth?: string | null): string | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  if (age < 0) return null;
  return age === 0 ? '1살 미만' : `${age}살`;
}

type MenuItem = { icon: LucideIcon; label: string; color: string; href: string };

const AI_CARE: MenuItem[] = [
  { icon: MessageCircle, label: '증상 분석', color: 'bg-blue-100 text-blue-600', href: '/search?mode=symptom' },
  { icon: Camera, label: '사진 분석', color: 'bg-purple-100 text-purple-600', href: '/search/photo' },
  { icon: FileSearch, label: '논문 검색', color: 'bg-sky-100 text-sky-600', href: '/search?mode=disease' },
  { icon: Bookmark, label: '보관함', color: 'bg-violet-100 text-violet-600', href: '/profile/saved' },
];

const HEALTH: MenuItem[] = [
  { icon: ClipboardList, label: '기록장', color: 'bg-emerald-100 text-emerald-600', href: '/records' },
  { icon: Calendar, label: '캘린더', color: 'bg-amber-100 text-amber-600', href: '/records?tab=calendar' },
  { icon: Scale, label: '체중 관리', color: 'bg-teal-100 text-teal-600', href: '/records/stats?tab=weight' },
  { icon: Wallet, label: '의료비', color: 'bg-rose-100 text-rose-600', href: '/records/stats?tab=cost' },
];

function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ icon: Icon, label, color, href }) => (
        <Link
          key={label}
          href={href}
          className="bg-white rounded-2xl py-3.5 flex flex-col items-center gap-2 shadow-sm border border-gray-100 active:scale-[0.97] transition-transform"
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={20} />
          </div>
          <span className="text-[11px] font-medium text-gray-700 text-center leading-tight px-0.5">{label}</span>
        </Link>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-gray-800 mb-2.5">
      <Icon size={16} className="text-gray-700" /> {title}
    </p>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[] | null>(null); // null=로딩, []=없음

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (alive) setPets(data ?? []);
    })();
    return () => { alive = false; };
  }, [user]);

  // 대표 펫: 마지막 선택/기본 펫 우선, 없으면 첫 펫
  let primaryPet: Pet | null = null;
  if (pets && pets.length > 0) {
    const savedId = typeof window !== 'undefined'
      ? (localStorage.getItem('lastSelectedPetId') || localStorage.getItem('defaultPetId'))
      : null;
    primaryPet = pets.find((p) => p.id === savedId) ?? pets[0];
  }

  const petInfo = primaryPet
    ? [
        calcAge(primaryPet.birth_date),
        primaryPet.breed,
        primaryPet.weight != null ? `${primaryPet.weight}kg` : null,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-3.5rem)] pb-6">
      <TrialBanner />
      <SamsungBrowserHint />

      {/* 상단 배너 캐러셀 */}
      <HomeBanner />

      {/* 펫 요약 (등록 O) / 등록 유도 (등록 X) */}
      <div className="px-4 pt-4">
        {pets === null ? (
          <div className="h-[68px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
        ) : primaryPet ? (
          <Link
            href="/profile"
            className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
          >
            <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
              {primaryPet.type === 'cat' ? <Cat size={24} /> : <Dog size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-gray-800 text-sm truncate">{primaryPet.name}</span>
                {pets.length > 1 && <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
              </div>
              {petInfo && <p className="text-xs text-gray-400 truncate">{petInfo}</p>}
            </div>
            <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
          </Link>
        ) : (
          <Link
            href="/profile"
            className="w-full bg-blue-50 border border-dashed border-blue-300 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-blue-400 flex-shrink-0">
              <Plus size={24} />
            </div>
            <p className="flex-1 font-bold text-blue-700 text-sm">프로필 등록하고 맞춤 케어 시작하기</p>
            <ChevronRight size={20} className="text-blue-300 flex-shrink-0" />
          </Link>
        )}
      </div>

      {/* AI 케어 */}
      <div className="px-4 pt-6">
        <SectionTitle icon={Stethoscope} title="AI 케어" />
        <MenuGrid items={AI_CARE} />
      </div>

      {/* 건강 기록 */}
      <div className="px-4 pt-6">
        <SectionTitle icon={ClipboardList} title="건강 기록" />
        <MenuGrid items={HEALTH} />
      </div>
    </div>
  );
}
