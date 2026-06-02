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
        className={`relative w-full text-left rounded-2xl overflow-hidden h-44 bg-gradient-to-br ${banner.gradient} px-5 pt-5 pb-10 flex flex-col justify-center text-white shadow-sm transition-transform active:scale-[0.99]`}
      >
        <p className="text-xs opacity-90 mb-2">{banner.badge}</p>
        <p className="text-xl font-bold leading-snug whitespace-pre-line">
          {banner.title}
        </p>
        <p className="text-sm font-medium opacity-95 mt-1.5">{banner.subtitle}</p>

        {/* 점 인디케이터 — 하단 중앙. 탭 시 해당 배너로 (이벤트 버블링 차단) */}
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1.5">
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
