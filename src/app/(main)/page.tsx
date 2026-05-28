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

// 그룹별 톤 통일 — 탭바/메뉴 색상이 산발적으로 겹쳐 보이던 문제 해소.
//   AI 케어 = 블루 계열 / 건강 기록 = 그린 계열 (아이콘으로 기능 구분)
const AI_CARE: MenuItem[] = [
  { icon: MessageCircle, label: '증상 분석', color: 'bg-blue-100 text-blue-600', href: '/search?mode=symptom' },
  { icon: Camera, label: '사진 분석', color: 'bg-blue-100 text-blue-600', href: '/search/photo' },
  { icon: FileSearch, label: '논문 검색', color: 'bg-blue-100 text-blue-600', href: '/search?mode=disease' },
  { icon: Bookmark, label: '보관함', color: 'bg-blue-100 text-blue-600', href: '/profile/saved' },
];

const HEALTH: MenuItem[] = [
  { icon: ClipboardList, label: '기록장', color: 'bg-emerald-100 text-emerald-600', href: '/records' },
  { icon: Calendar, label: '캘린더', color: 'bg-emerald-100 text-emerald-600', href: '/records?tab=calendar' },
  { icon: Scale, label: '체중 관리', color: 'bg-emerald-100 text-emerald-600', href: '/records/stats?tab=weight' },
  { icon: Wallet, label: '의료비', color: 'bg-emerald-100 text-emerald-600', href: '/records/stats?tab=cost' },
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
