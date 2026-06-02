'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 홈 상단 배너 캐러셀.
 *
 * Outline 스타일 (border-2 + 연한 배경 + 텍스트 = 테두리 색) — 미니멀, 부담 적음.
 * 자동 슬라이드 + 점 인디케이터 + 탭 시 이동.
 */
type ToneKey = 'amber' | 'indigo';

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: ToneKey;
  href: string;
};

const TONE: Record<ToneKey, {
  border: string;
  bg: string;
  text: string;        // 제목 / 서브 / 배지
  arrow: string;       // 좌우 화살표
  dotActive: string;
  dotInactive: string;
}> = {
  amber: {
    border: 'border-2 border-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    arrow: 'text-amber-600 hover:text-amber-700',
    dotActive: 'bg-amber-500',
    dotInactive: 'bg-amber-200',
  },
  indigo: {
    border: 'border-2 border-indigo-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    arrow: 'text-indigo-600 hover:text-indigo-700',
    dotActive: 'bg-indigo-500',
    dotInactive: 'bg-indigo-200',
  },
};

const BANNERS: Banner[] = [
  {
    id: 'plus',
    badge: 'PawDex Plus',
    title: '오늘의 기록이 내일의 건강 힌트가 되도록',
    subtitle: '진료·증상·일상 한 곳에',
    tone: 'amber',
    href: '/profile/subscription',
  },
  {
    id: 'ai',
    badge: 'AI 케어',
    title: 'AI가 기록을 함께 읽어드려요',
    subtitle: '진료 history 를 참고한 맞춤 증상 분석',
    tone: 'indigo',
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
  const tone = TONE[banner.tone];

  return (
    <div className="px-4 pt-4">
      <button
        type="button"
        onClick={() => router.push(banner.href)}
        className={`relative w-full text-left rounded-2xl overflow-hidden h-44 ${tone.bg} ${tone.border} p-5 flex flex-col justify-center transition-transform active:scale-[0.99]`}
      >
        <p className={`text-xs font-semibold ${tone.text} mb-2`}>{banner.badge}</p>
        <p className={`text-xl font-bold leading-snug ${tone.text}`}>
          {banner.title}
          <br />
          <span className={`text-base font-medium ${tone.text} opacity-90`}>{banner.subtitle}</span>
        </p>

        {/* 좌우 화살표 — 수동 넘기기 (버블링 차단) */}
        <span
          role="button"
          tabIndex={-1}
          aria-label="이전 배너"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + BANNERS.length) % BANNERS.length); }}
          className={`absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center ${tone.arrow} transition-colors`}
        >
          <ChevronLeft size={20} />
        </span>
        <span
          role="button"
          tabIndex={-1}
          aria-label="다음 배너"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % BANNERS.length); }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center ${tone.arrow} transition-colors`}
        >
          <ChevronRight size={20} />
        </span>

        {/* 점 인디케이터 — 하단 중앙 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {BANNERS.map((b, i) => (
            <span
              key={b.id}
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${i === idx ? tone.dotActive : tone.dotInactive}`}
            />
          ))}
        </div>
      </button>
    </div>
  );
}
