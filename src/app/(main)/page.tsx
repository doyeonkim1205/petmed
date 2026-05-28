'use client';

import Link from 'next/link';
import {
  MessageCircle, Camera, FileSearch, Bookmark,
  ClipboardList, Calendar, Scale, Wallet,
  Stethoscope, LucideIcon,
} from 'lucide-react';
import { HomeBanner } from '@/components/home/HomeBanner';
import { HealthTip } from '@/components/home/HealthTip';
import { TrialBanner } from '@/components/TrialBanner';
import { SamsungBrowserHint } from '@/components/SamsungBrowserHint';

type MenuItem = { icon: LucideIcon; label: string; color: string; href: string };

// 투명 칩(배경 없이 아이콘만) + 아이콘 의미에 맞춘 색.
//   증상=코발트 블루 / 사진=스카이 블루 / 논문=인디고(전문성·무게감) / 보관함=웜 오렌지.
//   기록장=포레스트 그린 / 캘린더=딥 오렌지 / 체중=터콰이즈 / 의료비=골드(돈).
const AI_CARE: MenuItem[] = [
  { icon: MessageCircle, label: '증상 분석', color: 'text-blue-600', href: '/search?mode=symptom' },
  { icon: Camera, label: '사진 분석', color: 'text-sky-500', href: '/search/photo' },
  { icon: FileSearch, label: '논문 검색', color: 'text-indigo-600', href: '/search?mode=disease' },
  { icon: Bookmark, label: '보관함', color: 'text-amber-500', href: '/profile/saved' },
];

const HEALTH: MenuItem[] = [
  { icon: ClipboardList, label: '기록장', color: 'text-green-700', href: '/records' },
  { icon: Calendar, label: '캘린더', color: 'text-orange-600', href: '/records?tab=calendar' },
  { icon: Scale, label: '체중 관리', color: 'text-teal-500', href: '/records/stats?tab=weight' },
  { icon: Wallet, label: '의료비', color: 'text-yellow-600', href: '/records/stats?tab=cost' },
];

function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ icon: Icon, label, color, href }) => (
        <Link
          key={label}
          href={href}
          className="py-2 flex flex-col items-center gap-2 rounded-xl active:scale-[0.95] transition-transform"
        >
          <Icon size={26} className={color} />
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
    <div className="bg-gray-50 min-h-[calc(100vh-3rem)] pb-6">
      <TrialBanner />
      <SamsungBrowserHint />

      {/* 상단 배너 캐러셀 */}
      <HomeBanner />

      {/* 오늘의 건강 팁 */}
      <div className="px-4 pt-3">
        <HealthTip />
      </div>

      {/* 기능 메뉴 — 섹션별 흰 카드 박스 */}
      <div className="px-4 pt-4 space-y-3">
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <SectionTitle icon={Stethoscope} title="AI 케어" />
          <MenuGrid items={AI_CARE} />
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <SectionTitle icon={ClipboardList} title="건강 기록" />
          <MenuGrid items={HEALTH} />
        </section>
      </div>
    </div>
  );
}
