'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 홈 상단 배너 캐러셀.
 *
 * 자사 공지/이벤트/Plus 유도용 (외부 광고 X). 자동 슬라이드 + 점 인디케이터 + 탭 시 이동.
 * 배너 목록은 현재 코드 내 정의 — 추후 관리자 등록(DB) 으로 확장 가능.
 */
type Banner = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  gradient: string;   // tailwind gradient classes
  href: string;
};

const BANNERS: Banner[] = [
  {
    id: 'photo',
    badge: 'NEW 기능',
    title: 'AI 사진 분석 출시!',
    subtitle: '사진 한 장으로 건강 체크',
    gradient: 'from-indigo-500 to-blue-600',
    href: '/search/photo',
  },
  {
    id: 'plus',
    badge: 'PawDex Plus',
    title: '무제한으로 더 똑똑하게',
    subtitle: '증상·사진 분석을 매일 넉넉하게',
    gradient: 'from-amber-500 to-orange-600',
    href: '/profile/subscription',
  },
  {
    id: 'search',
    badge: '수의학 논문',
    title: '믿을 수 있는 정보',
    subtitle: '질병·키워드로 논문을 검색해보세요',
    gradient: 'from-violet-500 to-indigo-600',
    href: '/search?mode=disease',
  },
];

const AUTO_MS = 4500;

export function HomeBanner() {
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % BANNERS.length);
    }, AUTO_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const banner = BANNERS[idx];

  return (
    <div className="px-4 pt-4">
      <button
        type="button"
        onClick={() => router.push(banner.href)}
        className={`relative w-full text-left rounded-2xl overflow-hidden h-44 bg-gradient-to-br ${banner.gradient} p-5 flex flex-col justify-center text-white shadow-sm transition-transform active:scale-[0.99]`}
      >
        <p className="text-xs opacity-90 mb-2">{banner.badge}</p>
        <p className="text-xl font-bold leading-snug">
          {banner.title}
          <br />
          <span className="text-base font-medium opacity-95">{banner.subtitle}</span>
        </p>

        {/* 좌우 화살표 — 수동 넘기기 (버블링 차단) */}
        <span
          role="button"
          tabIndex={-1}
          aria-label="이전 배너"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + BANNERS.length) % BANNERS.length); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
        </span>
        <span
          role="button"
          tabIndex={-1}
          aria-label="다음 배너"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % BANNERS.length); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          <ChevronRight size={20} />
        </span>

        {/* 점 인디케이터 — 탭하면 해당 배너로 (이벤트 버블링 차단) */}
        <div className="absolute bottom-4 right-5 flex gap-1.5">
          {BANNERS.map((b, i) => (
            <span
              key={b.id}
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      </button>
    </div>
  );
}
