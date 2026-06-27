'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  MessageCircle, Camera, FileSearch, Bookmark,
  ClipboardList, History, Activity, Wallet,
  Stethoscope, LucideIcon,
} from 'lucide-react';
import { HomeBanner } from '@/components/home/HomeBanner';
import { HealthBriefing } from '@/components/home/HealthBriefing';
import { HomeMedicationWidget } from '@/components/home/HomeMedicationWidget';
import { HomePreventiveWidget } from '@/components/home/HomePreventiveWidget';
import { TrialBanner } from '@/components/TrialBanner';
import { SamsungBrowserHint } from '@/components/SamsungBrowserHint';

type MenuItem = { icon: LucideIcon; labelKey: string; color: string; bg: string; href: string };

// 소프트 칩 — 아이콘을 같은 색 계열 옅은 배경 칩에 담음.
//   AI 케어 = 파랑 계열: 증상=코발트 / 사진=스카이 / 논문=인디고 / 보관함=남색.
//   건강 기록 = 그린·민트 계열: 기록장=딥그린 / 캘린더=소프트그린 / 건강통계=에메랄드 / 의료비=딥틸.
// 라벨은 messages 키로 분리 (labelKey). 모듈명은 record.module.*/record.tab/timeline 재사용.
const AI_CARE: MenuItem[] = [
  { icon: MessageCircle, labelKey: 'home.menu.symptomAnalysis', color: 'text-blue-600', bg: 'bg-blue-50', href: '/search?mode=symptom' },
  { icon: Camera, labelKey: 'home.menu.photoAnalysis', color: 'text-sky-500', bg: 'bg-sky-50', href: '/search/photo' },
  { icon: FileSearch, labelKey: 'home.menu.paperSearch', color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/search?mode=disease' },
  { icon: Bookmark, labelKey: 'home.menu.saved', color: 'text-blue-800', bg: 'bg-blue-50', href: '/profile/saved' },
];

const HEALTH: MenuItem[] = [
  { icon: ClipboardList, labelKey: 'record.tab.records', color: 'text-green-700', bg: 'bg-green-50', href: '/records' },
  { icon: Activity, labelKey: 'record.module.stats', color: 'text-emerald-500', bg: 'bg-emerald-50', href: '/records/stats' },
  { icon: History, labelKey: 'timeline.title', color: 'text-green-500', bg: 'bg-green-50', href: '/records/timeline' },
  { icon: Wallet, labelKey: 'record.module.expenses', color: 'text-[#00687a]', bg: 'bg-cyan-50', href: '/records/expenses' },
];

function MenuGrid({ items }: { items: MenuItem[] }) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ icon: Icon, labelKey, color, bg, href }) => (
        <Link
          key={labelKey}
          href={href}
          className="py-1.5 flex flex-col items-center gap-1.5 active:scale-[0.95] transition-transform"
        >
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg}`}>
            <Icon size={23} className={color} />
          </span>
          <span className="text-[11px] font-bold text-gray-700 text-center leading-tight px-0.5">{t(labelKey)}</span>
        </Link>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800 mb-2.5">
      <Icon size={14} className="text-gray-700" /> {title}
    </p>
  );
}

export default function HomePage() {
  const t = useTranslations('home.section');
  return (
    <div className="bg-gray-50 min-h-full pb-6">
      <TrialBanner />
      <SamsungBrowserHint />

      {/* 상단 배너 캐러셀 */}
      <HomeBanner />

      {/* 건강 브리핑 — 펫별 메트릭 + 동적 강조 */}
      <div className="px-4 pt-2.5">
        <HealthBriefing />
      </div>

      {/* 오늘의 복약 — 복용 중인 약이 있을 때만 노출 (없으면 자동 숨김) */}
      <div className="px-4 pt-2.5 empty:hidden">
        <HomeMedicationWidget />
      </div>

      {/* 예방 관리 — 30일 이내 챙길 예방이 있을 때만 노출 (없으면 자동 숨김) */}
      <div className="px-4 pt-2.5 empty:hidden">
        <HomePreventiveWidget />
      </div>

      {/* 기능 메뉴 — 섹션별 흰 카드 박스 (건강 기록 → AI 케어 순) */}
      <div className="px-4 pt-2.5 space-y-2.5">
        <section className="bg-white rounded-2xl p-4 border border-gray-100">
          <SectionTitle icon={ClipboardList} title={t('healthRecord')} />
          <MenuGrid items={HEALTH} />
        </section>

        <section className="bg-white rounded-2xl p-4 border border-gray-100">
          <SectionTitle icon={Stethoscope} title={t('aiCare')} />
          <MenuGrid items={AI_CARE} />
        </section>
      </div>
    </div>
  );
}
