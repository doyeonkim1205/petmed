'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { LoadingScreen } from '@/components/LoadingScreen';

// 온보딩/로그인 가드를 건너뛰는 공개 경로 (인스타 바이오 랜딩 + 약관/정책).
// 콜드 유입(localStorage 비어있음)이 온보딩에 가려지지 않고 바로 페이지를 보게 한다.
const PUBLIC_PREFIXES = ['/start', '/terms', '/privacy', '/business', '/refund', '/policies', '/location-terms'];

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

      {/* 사진 프레임 (살짝 기울어진 카드) — 미니멀 풍경 사진 */}
      <g transform="rotate(-8, 85, 85)">
        <rect x="50" y="50" width="70" height="70" rx="8" fill="white" stroke="#8B5CF6" strokeWidth="2.5" />
        {/* 하늘 영역 */}
        <rect x="55" y="55" width="60" height="44" rx="3" fill="#E0E7FF" />
        {/* 태양 */}
        <circle cx="100" cy="68" r="6" fill="#FBBF24" />
        {/* 뒷쪽 산 */}
        <path d="M55 95 L72 75 L88 90 L100 80 L115 95 Z" fill="#A78BFA" opacity="0.7" />
        {/* 앞쪽 산 */}
        <path d="M55 99 L68 84 L82 96 L95 86 L110 99 L115 99 L115 99 Z" fill="#8B5CF6" />
        {/* 땅(하단) */}
        <rect x="55" y="99" width="60" height="16" fill="#F5F3FF" />
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

function IllustRecord() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle — teal 톤 (기록/타임라인) */}
      <circle cx="100" cy="100" r="90" fill="#CCFBF1" />
      <circle cx="100" cy="100" r="70" fill="#99F6E4" opacity="0.5" />
      {/* 기록 카드 */}
      <rect x="48" y="48" width="104" height="104" rx="12" fill="white" stroke="#14B8A6" strokeWidth="2.5" />
      {/* 타임라인 세로선 */}
      <line x1="70" y1="68" x2="70" y2="134" stroke="#5EEAD4" strokeWidth="2.5" strokeLinecap="round" />
      {/* row 1 — 체크된 노드(기록 완료) */}
      <circle cx="70" cy="74" r="7" fill="#14B8A6" />
      <path d="M66.5 74 L69 76.5 L73.5 71.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="84" y="70" width="50" height="4" rx="2" fill="#5EEAD4" />
      <rect x="84" y="78" width="36" height="4" rx="2" fill="#CCFBF1" />
      {/* row 2 — 진료(blue) */}
      <circle cx="70" cy="102" r="6" fill="#3B82F6" />
      <rect x="84" y="98" width="46" height="4" rx="2" fill="#5EEAD4" />
      <rect x="84" y="106" width="32" height="4" rx="2" fill="#CCFBF1" />
      {/* row 3 — 복약(rose) */}
      <circle cx="70" cy="128" r="6" fill="#F43F5E" />
      <rect x="84" y="124" width="42" height="4" rx="2" fill="#5EEAD4" />
      <rect x="84" y="132" width="38" height="4" rx="2" fill="#CCFBF1" />
      {/* 작은 캘린더 배지 — 우상단(캘린더 연동 힌트) */}
      <g transform="translate(116, 36)">
        <rect x="0" y="0" width="34" height="30" rx="5" fill="white" stroke="#0D9488" strokeWidth="2" />
        <rect x="0" y="0" width="34" height="9" rx="5" fill="#0D9488" />
        <rect x="0" y="5" width="34" height="4" fill="#0D9488" />
        <rect x="8" y="-2" width="3" height="7" rx="1.5" fill="#0D9488" />
        <rect x="23" y="-2" width="3" height="7" rx="1.5" fill="#0D9488" />
        <circle cx="9" cy="18" r="2.2" fill="#5EEAD4" />
        <circle cx="17" cy="18" r="2.2" fill="#14B8A6" />
        <circle cx="25" cy="18" r="2.2" fill="#99F6E4" />
        <circle cx="9" cy="25" r="2.2" fill="#99F6E4" />
        <circle cx="17" cy="25" r="2.2" fill="#5EEAD4" />
      </g>
      {/* sparkles */}
      <circle cx="38" cy="64" r="3" fill="#FBBF24" />
      <circle cx="40" cy="150" r="2.5" fill="#FBBF24" />
    </svg>
  );
}

function IllustStats() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
      {/* Background circle — amber 톤 (건강 통계) */}
      <circle cx="100" cy="100" r="90" fill="#FEF3C7" />
      <circle cx="100" cy="100" r="70" fill="#FDE68A" opacity="0.4" />
      {/* 차트 카드 */}
      <rect x="44" y="52" width="112" height="96" rx="12" fill="white" stroke="#F59E0B" strokeWidth="2.5" />
      {/* 축 */}
      <line x1="62" y1="66" x2="62" y2="132" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="132" x2="144" y2="132" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
      {/* 막대 — 점점 증가 */}
      <rect x="74" y="110" width="16" height="22" rx="3" fill="#FCD34D" />
      <rect x="100" y="96" width="16" height="36" rx="3" fill="#FBBF24" />
      <rect x="126" y="80" width="16" height="52" rx="3" fill="#F59E0B" />
      {/* 추세선 + 포인트 */}
      <polyline points="82,104 108,90 134,74" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="82" cy="104" r="3.5" fill="white" stroke="#F97316" strokeWidth="2" />
      <circle cx="108" cy="90" r="3.5" fill="white" stroke="#F97316" strokeWidth="2" />
      <circle cx="134" cy="74" r="3.5" fill="#F97316" />
      {/* 상승 화살표 */}
      <path d="M128 70 L134 64 L140 70" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* sparkles */}
      <circle cx="40" cy="62" r="3" fill="#FBBF24" />
      <circle cx="166" cy="70" r="2.5" fill="#FBBF24" />
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

// 슬라이드 텍스트는 messages(onboarding.slideN.title/desc)로 분리 — key 로 참조.
const slides = [
  { Illustration: IllustPaw, key: 'slide1', gradient: 'from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-950', accentColor: '#3B82F6' },
  { Illustration: IllustAI, key: 'slide2', gradient: 'from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-950', accentColor: '#8B5CF6' },
  { Illustration: IllustRecord, key: 'slide3', gradient: 'from-teal-50 to-white dark:from-teal-950/30 dark:to-gray-950', accentColor: '#14B8A6' },
  { Illustration: IllustStats, key: 'slide4', gradient: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-950', accentColor: '#F59E0B' },
  { Illustration: IllustSearch, key: 'slide5', gradient: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-950', accentColor: '#10B981' },
  { Illustration: IllustMap, key: 'slide6', gradient: 'from-rose-50 to-white dark:from-rose-950/30 dark:to-gray-950', accentColor: '#F43F5E' },
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations();
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
            {t('common.skip')}
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
              {t(`onboarding.${slide.key}.title`)}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={hasMounted ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line"
            >
              {t(`onboarding.${slide.key}.desc`)}
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
          {page === slides.length - 1 ? t('common.start') : t('common.next')}
        </motion.button>
      </div>
    </div>
  );
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + '/'));

  useEffect(() => {
    if (isPublic) { setChecked(true); return; }
    const done = localStorage.getItem('pawdex_onboarded');
    if (!done) {
      setShowOnboarding(true);
    }
    setChecked(true);
  }, [isPublic]);

  const handleComplete = () => {
    localStorage.setItem('pawdex_onboarded', 'true');
    setShowOnboarding(false);
    // 비로그인이면 /login 으로. (main) 레이아웃이 이미 blank guard 를 주므로
    // 여기서 별도 오버레이는 필요 없음 — 중복이면 오히려 stuck 위험.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });
  };

  // 공개 경로(랜딩/약관)는 온보딩·로그인 가드 없이 즉시 렌더 (SEO + 콜드 유입)
  if (isPublic) return <>{children}</>;

  // localStorage 확인 전까지 하얀 화면 (깜박임 방지)
  // 세션/온보딩 확인 전 — 빈 흰 화면 대신 스플래시와 동일한 로딩화면(아이콘+스피너)으로
  //   스플래시→앱 전환 시 아이콘이 끊기지 않게 한다.
  if (!checked) return <LoadingScreen />;

  // 온보딩 진행 중엔 children 렌더링 자체를 막아 한 프레임짜리 홈 플래시 제거
  return <>{showOnboarding ? <Onboarding onComplete={handleComplete} /> : children}</>;
}
