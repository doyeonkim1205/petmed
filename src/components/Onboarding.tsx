'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ─── SVG Illustrations ─── */

function IllustPaw() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle */}
      <circle cx="100" cy="100" r="90" fill="#DBEAFE" />
      <circle cx="100" cy="100" r="70" fill="#BFDBFE" opacity="0.6" />
      {/* Paw pad - main */}
      <ellipse cx="100" cy="120" rx="28" ry="24" fill="#3B82F6" />
      {/* Paw toes */}
      <ellipse cx="72" cy="90" rx="14" ry="17" fill="#3B82F6" transform="rotate(-15, 72, 90)" />
      <ellipse cx="92" cy="78" rx="13" ry="16" fill="#3B82F6" transform="rotate(-5, 92, 78)" />
      <ellipse cx="112" cy="78" rx="13" ry="16" fill="#3B82F6" transform="rotate(5, 112, 78)" />
      <ellipse cx="130" cy="90" rx="14" ry="17" fill="#3B82F6" transform="rotate(15, 130, 90)" />
      {/* Heart */}
      <path d="M90 135 C90 130, 82 125, 82 130 C82 136, 90 142, 90 142 C90 142, 98 136, 98 130 C98 125, 90 130, 90 135Z" fill="#EF4444" opacity="0.8" transform="translate(12, -2) scale(1.2)" />
      {/* Sparkles */}
      <circle cx="45" cy="55" r="3" fill="#FBBF24" />
      <circle cx="155" cy="60" r="2.5" fill="#FBBF24" />
      <circle cx="50" cy="150" r="2" fill="#FBBF24" />
      <circle cx="160" cy="140" r="3" fill="#FBBF24" />
      {/* Cross sparkle */}
      <path d="M150 45 L152 40 L154 45 L159 47 L154 49 L152 54 L150 49 L145 47Z" fill="#F59E0B" opacity="0.7" />
      <path d="M38 120 L40 116 L42 120 L46 122 L42 124 L40 128 L38 124 L34 122Z" fill="#F59E0B" opacity="0.5" />
    </svg>
  );
}

function IllustAI() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle — purple 톤 (AI 진단) */}
      <circle cx="100" cy="100" r="90" fill="#EDE9FE" />
      <circle cx="100" cy="100" r="70" fill="#DDD6FE" opacity="0.5" />

      {/* 사진 프레임 (살짝 기울어진 카드) */}
      <g transform="rotate(-8, 85, 85)">
        <rect x="50" y="50" width="70" height="70" rx="8" fill="white" stroke="#8B5CF6" strokeWidth="2.5" />
        {/* 강아지 얼굴 — 노란 톤 */}
        <ellipse cx="85" cy="92" rx="22" ry="20" fill="#FBBF24" />
        {/* 귀 */}
        <ellipse cx="68" cy="73" rx="7" ry="11" fill="#F59E0B" transform="rotate(-25, 68, 73)" />
        <ellipse cx="102" cy="73" rx="7" ry="11" fill="#F59E0B" transform="rotate(25, 102, 73)" />
        {/* 눈 */}
        <circle cx="79" cy="90" r="2.5" fill="#1F2937" />
        <circle cx="91" cy="90" r="2.5" fill="#1F2937" />
        {/* 코 */}
        <ellipse cx="85" cy="100" rx="3" ry="2" fill="#1F2937" />
        {/* 미소 */}
        <path d="M82 105 Q85 108 88 105" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </g>

      {/* 말풍선 (분석 결과) — 오른쪽 하단 */}
      <g>
        <rect x="105" y="115" width="62" height="42" rx="10" fill="white" stroke="#8B5CF6" strokeWidth="2" />
        {/* 말풍선 꼬리 */}
        <path d="M115 154 L108 165 L122 158 Z" fill="white" stroke="#8B5CF6" strokeWidth="2" strokeLinejoin="round" />
        <path d="M115 155 L122 158" stroke="white" strokeWidth="2.5" />
        {/* 분석 결과 라인 (텍스트 가짜) */}
        <rect x="113" y="124" width="46" height="3" rx="1.5" fill="#A78BFA" />
        <rect x="113" y="132" width="36" height="3" rx="1.5" fill="#C4B5FD" />
        <rect x="113" y="140" width="42" height="3" rx="1.5" fill="#DDD6FE" />
        {/* AI 체크 마크 */}
        <circle cx="155" cy="142" r="5" fill="#10B981" />
        <path d="M152 142 L154 144 L158 140" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* AI 스파클 — 사진 위 */}
      <g transform="translate(135, 38)">
        <path d="M6 0 L8 5 L13 7 L8 9 L6 14 L4 9 L-1 7 L4 5 Z" fill="#A78BFA" />
      </g>
      {/* AI 텍스트 (작게) */}
      <g transform="translate(28, 90)">
        <circle cx="8" cy="8" r="10" fill="#A78BFA" opacity="0.3" />
        <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#7C3AED">AI</text>
      </g>
      {/* Small sparkles */}
      <circle cx="50" cy="55" r="3" fill="#FBBF24" />
      <circle cx="158" cy="65" r="2.5" fill="#FBBF24" />
      <circle cx="42" cy="160" r="2" fill="#FBBF24" />
      <path d="M170 105 L172 100 L174 105 L179 107 L174 109 L172 114 L170 109 L165 107Z" fill="#F59E0B" opacity="0.6" />
    </svg>
  );
}

function IllustSearch() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle */}
      <circle cx="100" cy="100" r="90" fill="#D1FAE5" />
      <circle cx="100" cy="100" r="70" fill="#A7F3D0" opacity="0.5" />
      {/* Document */}
      <rect x="60" y="50" width="70" height="90" rx="8" fill="white" stroke="#10B981" strokeWidth="2.5" />
      {/* Text lines */}
      <rect x="72" y="65" width="46" height="4" rx="2" fill="#6EE7B7" />
      <rect x="72" y="76" width="38" height="4" rx="2" fill="#6EE7B7" />
      <rect x="72" y="87" width="42" height="4" rx="2" fill="#A7F3D0" />
      <rect x="72" y="98" width="30" height="4" rx="2" fill="#A7F3D0" />
      <rect x="72" y="109" width="46" height="4" rx="2" fill="#D1FAE5" />
      {/* Magnifying glass */}
      <circle cx="130" cy="120" r="22" fill="white" stroke="#059669" strokeWidth="3" />
      <line x1="146" y1="136" x2="162" y2="152" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
      {/* Check mark in magnifier */}
      <path d="M120 120 L127 127 L142 112" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* AI sparkle */}
      <circle cx="52" cy="75" r="8" fill="#34D399" opacity="0.3" />
      <text x="48" y="79" fontSize="10" fontWeight="bold" fill="#059669">AI</text>
      {/* Small sparkles */}
      <circle cx="155" cy="55" r="3" fill="#FBBF24" />
      <circle cx="42" cy="130" r="2.5" fill="#FBBF24" />
    </svg>
  );
}

function IllustCalendar() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle */}
      <circle cx="100" cy="100" r="90" fill="#FEF3C7" />
      <circle cx="100" cy="100" r="70" fill="#FDE68A" opacity="0.4" />
      {/* Calendar body */}
      <rect x="45" y="55" width="110" height="100" rx="12" fill="white" stroke="#F59E0B" strokeWidth="2.5" />
      {/* Calendar header */}
      <rect x="45" y="55" width="110" height="28" rx="12" fill="#F59E0B" />
      <rect x="45" y="71" width="110" height="12" fill="#F59E0B" />
      {/* Calendar hooks */}
      <rect x="72" y="48" width="6" height="16" rx="3" fill="#D97706" />
      <rect x="122" y="48" width="6" height="16" rx="3" fill="#D97706" />
      {/* Month text */}
      <text x="100" y="74" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white">2월</text>
      {/* Day grid */}
      {[0, 1, 2, 3, 4, 5, 6].map((col) => (
        <text key={`h${col}`} x={57 + col * 14} y="97" textAnchor="middle" fontSize="7" fill="#9CA3AF">
          {['일', '월', '화', '수', '목', '금', '토'][col]}
        </text>
      ))}
      {/* Day dots - colored events */}
      <circle cx="57" cy="110" r="4" fill="#3B82F6" opacity="0.8" />
      <circle cx="85" cy="110" r="4" fill="#EF4444" opacity="0.8" />
      <circle cx="99" cy="124" r="4" fill="#10B981" opacity="0.8" />
      <circle cx="71" cy="138" r="4" fill="#8B5CF6" opacity="0.8" />
      <circle cx="113" cy="138" r="4" fill="#3B82F6" opacity="0.8" />
      {/* Day numbers (faint) */}
      <text x="57" y="113" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">3</text>
      <text x="85" y="113" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">5</text>
      <text x="99" y="127" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">12</text>
      <text x="71" y="141" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">17</text>
      <text x="113" y="141" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">19</text>
      {/* Pencil */}
      <rect x="140" y="115" width="8" height="38" rx="2" fill="#F59E0B" transform="rotate(25, 144, 134)" />
      <polygon points="138,150 142,158 146,150" fill="#FDE68A" transform="rotate(25, 142, 154)" />
      {/* Small sparkles */}
      <circle cx="38" cy="60" r="3" fill="#FBBF24" />
      <circle cx="165" cy="70" r="2.5" fill="#FBBF24" />
    </svg>
  );
}

function IllustMap() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle */}
      <circle cx="100" cy="100" r="90" fill="#FFE4E6" />
      <circle cx="100" cy="100" r="70" fill="#FECDD3" opacity="0.5" />
      {/* Map base */}
      <rect x="40" y="55" width="120" height="95" rx="12" fill="white" stroke="#FB7185" strokeWidth="2" />
      {/* Map roads */}
      <line x1="40" y1="90" x2="160" y2="90" stroke="#FED7AA" strokeWidth="6" />
      <line x1="100" y1="55" x2="100" y2="150" stroke="#FED7AA" strokeWidth="6" />
      <line x1="55" y1="55" x2="145" y2="150" stroke="#FECACA" strokeWidth="3" opacity="0.5" />
      {/* Map areas */}
      <rect x="42" y="57" width="56" height="31" rx="4" fill="#DBEAFE" opacity="0.5" />
      <rect x="102" y="92" width="56" height="56" rx="4" fill="#D1FAE5" opacity="0.5" />
      {/* Location pin - main */}
      <g transform="translate(95, 40)">
        <path d="M10 0 C4.5 0 0 4.5 0 10 C0 17.5 10 30 10 30 C10 30 20 17.5 20 10 C20 4.5 15.5 0 10 0Z" fill="#EF4444" />
        <circle cx="10" cy="10" r="5" fill="white" />
        {/* Cross icon inside pin */}
        <line x1="7" y1="10" x2="13" y2="10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="7" x2="10" y2="13" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Small pins */}
      <g transform="translate(55, 95) scale(0.5)">
        <path d="M10 0 C4.5 0 0 4.5 0 10 C0 17.5 10 30 10 30 C10 30 20 17.5 20 10 C20 4.5 15.5 0 10 0Z" fill="#3B82F6" />
        <circle cx="10" cy="10" r="4" fill="white" />
      </g>
      <g transform="translate(130, 70) scale(0.45)">
        <path d="M10 0 C4.5 0 0 4.5 0 10 C0 17.5 10 30 10 30 C10 30 20 17.5 20 10 C20 4.5 15.5 0 10 0Z" fill="#10B981" />
        <circle cx="10" cy="10" r="4" fill="white" />
      </g>
      {/* 24h badge */}
      <rect x="120" y="108" width="32" height="16" rx="8" fill="#EF4444" />
      <text x="136" y="119" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">24h</text>
      {/* Pulse rings */}
      <circle cx="105" cy="55" r="12" fill="none" stroke="#EF4444" strokeWidth="1" opacity="0.3" />
      <circle cx="105" cy="55" r="18" fill="none" stroke="#EF4444" strokeWidth="0.5" opacity="0.15" />
      {/* Sparkles */}
      <circle cx="35" cy="50" r="3" fill="#FBBF24" />
      <circle cx="170" cy="65" r="2.5" fill="#FBBF24" />
    </svg>
  );
}

const slides = [
  {
    Illustration: IllustPaw,
    title: 'PawDex는 이브의 치료 경험에서\n시작됐어요',
    desc: '10살 이브가 치료를 받던 시간,\n믿을 수 있는 정보와 꾸준한 기록이 꼭 필요했습니다.',
    gradient: 'from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-950',
    accentColor: '#3B82F6',
  },
  {
    Illustration: IllustAI,
    title: '증상이나 사진으로\nAI 분석을 받아보세요',
    desc: '말로 풀어 적어도, 사진 한 장만으로도\nAI가 의심 진단과 행동 가이드를 알려줘요.',
    gradient: 'from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-950',
    accentColor: '#8B5CF6',
  },
  {
    Illustration: IllustSearch,
    title: '핵심만 빠르게,\n원문까지 투명하게',
    desc: '관련 논문을 번역·요약해 쉽게 이해하고,\n필요하면 원문으로 직접 확인할 수 있어요.',
    gradient: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-950',
    accentColor: '#10B981',
  },
  {
    Illustration: IllustCalendar,
    title: '오늘의 상태가\n내일의 힌트가 되도록',
    desc: '증상·진료 기록을 남기면 캘린더에 반영되어\n일정 관리가 쉬워집니다.',
    gradient: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-950',
    accentColor: '#F59E0B',
  },
  {
    Illustration: IllustMap,
    title: '급한 순간,\n덜 헤매도록',
    desc: '지도에서 24시 병원을 빠르게 찾고,\n바로 이동할 수 있게 연결해요.',
    gradient: 'from-rose-50 to-white dark:from-rose-950/30 dark:to-gray-950',
    accentColor: '#F43F5E',
  },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef(0);
  // 최초 마운트 시엔 애니메이션 비활성 (페이드-인 단계가 "두 번 뜨는 느낌" 유발)
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

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
  const Illust = slide.Illustration;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-gray-950 overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      {page < slides.length - 1 && (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => onComplete()}
            className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            건너뛰기
          </button>
        </div>
      )}

      {/* Background gradient */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${page}`}
          initial={hasMounted ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`absolute inset-0 bg-gradient-to-b ${slide.gradient}`}
        />
      </AnimatePresence>

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={hasMounted ? { opacity: 0, x: direction * 80 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -80 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center w-full max-w-sm"
          >
            {/* Illustration */}
            <motion.div
              initial={hasMounted ? { scale: 0.8, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
              className="w-52 h-52 mb-10"
            >
              <Illust />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={hasMounted ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-[22px] font-bold text-gray-900 dark:text-white mb-4 leading-snug whitespace-pre-line tracking-tight"
            >
              {slide.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={hasMounted ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line"
            >
              {slide.desc}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative pb-10 pt-4 px-8">
        {/* Page indicator */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {slides.map((s, i) => (
            <motion.div
              key={i}
              initial={hasMounted ? undefined : {
                width: i === page ? 24 : 8,
                backgroundColor: i === page ? s.accentColor : '#D1D5DB',
              }}
              animate={{
                width: i === page ? 24 : 8,
                backgroundColor: i === page ? s.accentColor : '#D1D5DB',
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
          initial={hasMounted ? undefined : { backgroundColor: slide.accentColor }}
          animate={{ backgroundColor: slide.accentColor }}
          transition={{ duration: 0.4 }}
          className="w-full h-[52px] text-white font-semibold rounded-2xl text-[16px] shadow-lg"
          style={{ boxShadow: `0 8px 24px ${slide.accentColor}33` }}
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
  const router = useRouter();

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
    // 비로그인이면 /login 으로. (main) 레이아웃이 이미 blank guard 를 주므로
    // 여기서 별도 오버레이는 필요 없음 — 중복이면 오히려 stuck 위험.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });
  };

  // localStorage 확인 전까지 하얀 화면 (깜박임 방지)
  if (!checked) return <div className="fixed inset-0 bg-white z-[200]" />;

  // 온보딩 진행 중엔 children 렌더링 자체를 막아 한 프레임짜리 홈 플래시 제거
  return <>{showOnboarding ? <Onboarding onComplete={handleComplete} /> : children}</>;
}
