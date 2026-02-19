'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const slides = [
  {
    emoji: '\uD83D\uDC3E',
    title: 'PawDex는 이브의 치료 경험에서\n시작됐어요',
    desc: '10살 이브가 치료를 받던 시간,\n믿을 수 있는 정보와 꾸준한 기록이 꼭 필요했습니다.',
    gradient: 'from-blue-500/10 via-blue-400/5 to-transparent',
    ring: 'bg-blue-100 dark:bg-blue-900/40',
    emojiShadow: 'shadow-blue-200/50 dark:shadow-blue-800/30',
  },
  {
    emoji: '\uD83D\uDCC4',
    title: '핵심만 빠르게,\n원문까지 투명하게',
    desc: '관련 논문을 번역·요약해 쉽게 이해하고,\n필요하면 원문으로 직접 확인할 수 있어요.',
    gradient: 'from-emerald-500/10 via-emerald-400/5 to-transparent',
    ring: 'bg-emerald-100 dark:bg-emerald-900/40',
    emojiShadow: 'shadow-emerald-200/50 dark:shadow-emerald-800/30',
  },
  {
    emoji: '\uD83D\uDCC5',
    title: '오늘의 상태가\n내일의 힌트가 되도록',
    desc: '증상·진료 기록을 남기면 캘린더에 반영되어\n일정 관리가 쉬워집니다.',
    gradient: 'from-amber-500/10 via-amber-400/5 to-transparent',
    ring: 'bg-amber-100 dark:bg-amber-900/40',
    emojiShadow: 'shadow-amber-200/50 dark:shadow-amber-800/30',
  },
  {
    emoji: '\uD83D\uDDFA\uFE0F',
    title: '급한 순간,\n덜 헤매도록',
    desc: '지도에서 24시 병원을 빠르게 찾고,\n바로 이동할 수 있게 연결해요.',
    gradient: 'from-rose-500/10 via-rose-400/5 to-transparent',
    ring: 'bg-rose-100 dark:bg-rose-900/40',
    emojiShadow: 'shadow-rose-200/50 dark:shadow-rose-800/30',
  },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef(0);

  const goNext = useCallback(() => {
    if (page < slides.length - 1) {
      setDirection(1);
      setPage((p) => p + 1);
    } else {
      onComplete();
    }
  }, [page, onComplete]);

  const goPrev = useCallback(() => {
    if (page > 0) {
      setDirection(-1);
      setPage((p) => p - 1);
    }
  }, [page]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50) goNext();
    else if (delta < -50) goPrev();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  const slide = slides[page];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-950 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      {page < slides.length - 1 && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            건너뛰기
          </button>
        </div>
      )}

      {/* Background gradient — changes per slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${page}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`absolute inset-0 bg-gradient-to-b ${slide.gradient}`}
        />
      </AnimatePresence>

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center max-w-xs"
          >
            {/* Emoji with decorative ring */}
            <div className={`relative w-32 h-32 rounded-full ${slide.ring} flex items-center justify-center mb-8 shadow-lg ${slide.emojiShadow}`}>
              <motion.span
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="text-6xl"
              >
                {slide.emoji}
              </motion.span>
            </div>

            {/* Title */}
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white mb-4 leading-snug whitespace-pre-line tracking-tight">
              {slide.title}
            </h2>

            {/* Description */}
            <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">
              {slide.desc}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative pb-10 pt-4 px-8">
        {/* Page indicator */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {slides.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === page ? 24 : 8,
                backgroundColor: i === page ? '#2563eb' : (typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#374151' : '#d1d5db'),
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          onClick={goNext}
          whileTap={{ scale: 0.97 }}
          className="w-full h-[52px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-2xl transition-colors text-[16px] shadow-lg shadow-blue-600/25"
        >
          {page === slides.length - 1 ? '시작하기' : '다음'}
        </motion.button>
      </div>
    </div>
  );
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem('pawdex_onboarded');
    if (!done) {
      setShowOnboarding(true);
    }
    setChecked(true);
  }, []);

  const handleComplete = () => {
    localStorage.setItem('pawdex_onboarded', 'true');
    setShowOnboarding(false);
  };

  if (!checked) return null;

  return (
    <>
      {showOnboarding && <Onboarding onComplete={handleComplete} />}
      {children}
    </>
  );
}
