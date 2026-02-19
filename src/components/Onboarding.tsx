'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const slides = [
  {
    emoji: '\uD83D\uDC3E',
    title: 'PawDex는 이브의 치료 경험에서 시작됐어요',
    desc: '10살 이브가 치료를 받던 시간, 믿을 수 있는 정보와 꾸준한 기록이 꼭 필요했습니다.',
  },
  {
    emoji: '\uD83D\uDCC4',
    title: '핵심만 빠르게, 원문까지 투명하게',
    desc: '관련 논문을 번역·요약해 쉽게 이해하고, 필요하면 원문으로 직접 확인할 수 있어요.',
  },
  {
    emoji: '\uD83D\uDCC5',
    title: '오늘의 상태가 내일의 힌트가 되도록',
    desc: '증상·진료 기록을 남기면 캘린더에 반영되어 일정 관리가 쉬워집니다.',
  },
  {
    emoji: '\uD83D\uDDFA\uFE0F',
    title: '급한 순간, 덜 헤매도록',
    desc: '지도에서 24시 병원을 빠르게 찾고, 바로 이동할 수 있게 연결해요.',
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

  // Keyboard navigation
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
      className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Content area */}
      <div className="flex-1 flex items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -80 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="text-center max-w-sm"
          >
            <div className="text-7xl mb-6">{slide.emoji}</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
              {slide.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {slide.desc}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="pb-12 px-8">
        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === page
                  ? 'w-6 bg-blue-600'
                  : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={goNext}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
        >
          {page === slides.length - 1 ? '시작하기' : '다음'}
        </button>
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
