'use client';

import Link from 'next/link';
import {
  MessageCircle, Camera, FileSearch, Bookmark,
  ClipboardList, Calendar, Scale, Wallet,
  Stethoscope, LucideIcon,
} from 'lucide-react';
import { HomeBanner } from '@/components/home/HomeBanner';
import { TrialBanner } from '@/components/TrialBanner';
import { SamsungBrowserHint } from '@/components/SamsungBrowserHint';

type MenuItem = { icon: LucideIcon; label: string; color: string; href: string };

// 투명 칩(배경 없이 아이콘만) + 기능 의미색.
//   브랜드 컨셉: 주력 AI 진단(증상·사진) = 파랑(브랜드색) / 논문 검색 = 보라(보조).
//   건강 기록 = 의미색(기록 초록 / 캘린더 주황 / 체중 청록 / 의료비 초록=돈).
const AI_CARE: MenuItem[] = [
  { icon: MessageCircle, label: '증상 분석', color: 'text-blue-500', href: '/search?mode=symptom' },
  { icon: Camera, label: '사진 분석', color: 'text-sky-500', href: '/search/photo' },
  { icon: FileSearch, label: '논문 검색', color: 'text-violet-500', href: '/search?mode=disease' },
  { icon: Bookmark, label: '보관함', color: 'text-amber-500', href: '/profile/saved' },
];

const HEALTH: MenuItem[] = [
  { icon: ClipboardList, label: '기록장', color: 'text-emerald-500', href: '/records' },
  { icon: Calendar, label: '캘린더', color: 'text-orange-500', href: '/records?tab=calendar' },
  { icon: Scale, label: '체중 관리', color: 'text-teal-500', href: '/records/stats?tab=weight' },
  { icon: Wallet, label: '의료비', color: 'text-green-600', href: '/records/stats?tab=cost' },
];

function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ icon: Icon, label, color, href }) => (
        <Link
          key={label}
          href={href}
          className="bg-white rounded-2xl py-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 active:scale-[0.97] transition-transform"
        >
          <Icon size={24} className={color} />
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
  return (
    <div className="bg-white min-h-[calc(100vh-3rem)] pb-6">
      <TrialBanner />
      <SamsungBrowserHint />

      {/* 상단 배너 캐러셀 */}
      <HomeBanner />

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
