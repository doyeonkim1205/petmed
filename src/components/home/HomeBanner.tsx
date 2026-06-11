'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 홈 상단 배너 캐러셀.
 *
 * 그라데이션 배경 + 흰 텍스트 (시각 임팩트 강조). 자동 슬라이드 + 점 indicator +
 * 탭 시 이동. 좌우 화살표는 텍스트 가림 문제로 제거 — 모바일은 swipe + 자동 슬라이드
 * + 점 tap 으로 충분.
 */
type Banner = {
  id: string;
  /** \n 포함 시 whitespace-pre-line 으로 줄바꿈 렌더 */
  title: string;
  subtitle: string;
  badge: string;
  gradient: string;  // tailwind gradient classes
  href: string;
};

const BANNERS: Banner[] = [
  {
    id: 'plus',
    badge: 'PawDex Plus',
    title: '오늘의 기록이,\n내일의 건강 힌트가 되도록',
    subtitle: '진료·증상·일상을 한 곳에',
    gradient: 'from-amber-500 to-orange-600',
    href: '/profile/subscription',
  },
  {
    id: 'ai',
    badge: 'AI 케어',
    title: 'AI가 기록을 함께 읽어드려요',
    subtitle: '우리 아이 건강 기록을 바탕으로 증상을 분석해요',
    gradient: 'from-sky-500 to-indigo-600',
    href: '/search?mode=symptom',
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
        className={`relative w-full text-left rounded-2xl overflow-hidden h-40 bg-gradient-to-br ${banner.gradient} px-5 py-5 flex flex-col justify-center text-white shadow-sm transition-transform active:scale-[0.99]`}
      >
        {/* 장식 — 은은한 반투명 원 (깊이감) */}
        <span className="pointer-events-none absolute -right-7 -top-10 w-32 h-32 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -right-12 bottom-0 w-28 h-28 rounded-full bg-white/10" />

        <span className="relative inline-flex w-fit items-center text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-full mb-2.5">{banner.badge}</span>
        <p className="relative text-[19px] font-bold leading-snug whitespace-pre-line">
          {banner.title}
        </p>
        <p className="relative text-[13px] font-medium opacity-90 mt-1.5">{banner.subtitle}</p>

        {/* 인디케이터 — 하단 좌측, 활성 칩은 길게 (현대적) */}
        <div className="absolute bottom-4 left-5 flex gap-1.5">
          {BANNERS.map((b, i) => (
            <span
              key={b.id}
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </button>
    </div>
  );
}
