'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { PawPrint, MessageSquare, Calendar, Cake } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthBriefing, type PetBriefing } from '@/hooks/useHealthBriefing';
import { formatAge } from '@/lib/healthBriefing';

/**
 * 홈 "건강 브리핑" 카드 — 기존 HealthTip 자리에 들어감.
 *
 * 상태:
 *   - 펫 0마리 → 환영 카드 ("반려동물을 등록해주세요")
 *   - 펫 있음 + 기록 0 → 펫 카드 + "첫 기록을 남겨볼까요?"
 *   - 펫 있음 + 기록 있음 → 펫별 슬라이드 (scroll-snap) + 동적 강조
 *
 * 동적 강조 우선순위 (pickHighlight in lib):
 *   1. 생일 (rose)
 *   2. 예약 D-7 (amber)
 *   3. 기록 7일+ (blue)
 *
 * 슬라이드: native scroll-snap (라이브러리 X). 펫 ≥ 2 일 때 점 indicator.
 */
export function HealthBriefing() {
  const { user } = useAuth();
  const { briefings, petsCount, loading } = useHealthBriefing(user?.id);

  // 로딩 중엔 자리 차지하는 빈 carcass — layout shift 방지.
  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm h-[88px]" />
    );
  }

  // 펫 0마리 → 환영 카드
  if (petsCount === 0) {
    return <WelcomeCard />;
  }

  // 펫 있음 + 모든 펫의 기록 0
  const allRecordsEmpty = briefings.every((b) => b.daysSinceLastRecord === null);
  if (allRecordsEmpty) {
    return <FirstRecordCard briefings={briefings} />;
  }

  // 정상 — 펫별 슬라이드
  return <BriefingSlider briefings={briefings} />;
}

// ────────────────────────────────────────────────
// 환영 카드 (펫 0마리)
// ────────────────────────────────────────────────
function WelcomeCard() {
  return (
    <Link
      href="/profile"
      className="block rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <PawPrint size={18} className="text-blue-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 mb-0.5">반려동물을 등록해주세요</p>
          <p className="text-[11px] text-gray-500 leading-snug">가족의 건강을 함께 챙겨드릴게요</p>
        </div>
        <span className="text-[11px] font-bold text-blue-600 flex-shrink-0">등록 →</span>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────
// 첫 기록 CTA (펫 있음, 기록 0)
// ────────────────────────────────────────────────
function FirstRecordCard({ briefings }: { briefings: PetBriefing[] }) {
  // 첫 펫만 표시. 여러 마리여도 단순화.
  const first = briefings[0];
  const ageLabel = formatAge(first.age);
  const meta = [ageLabel, first.pet.weight ? `${first.pet.weight}kg` : null].filter(Boolean).join(' · ');
  return (
    <Link
      href="/records/add"
      className="block rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden active:scale-[0.99] transition-transform"
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <PetAvatar />
        <p className="text-sm font-bold text-gray-800">
          {first.pet.name}
          {meta && <span className="text-[10px] font-medium text-gray-400 ml-1.5">{meta}</span>}
        </p>
      </div>
      <div className="px-4 pb-4 pt-1">
        <p className="text-[13px] text-gray-700 mb-1.5">첫 기록을 남겨볼까요?</p>
        <p className="text-[11px] text-gray-500 mb-2">{first.pet.name}의 건강을 기록하기 시작해요</p>
        <span className="text-[11px] font-bold text-green-700">기록 추가 →</span>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────
// 펫별 슬라이드 (메인 케이스)
// ────────────────────────────────────────────────
function BriefingSlider({ briefings }: { briefings: PetBriefing[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || briefings.length <= 1) return;
    const handler = () => {
      // 카드 1장 = scrollLeft 가 약 width 단위로 이동. round 로 active idx.
      const cardWidth = el.clientWidth;
      if (cardWidth <= 0) return;
      setActiveIdx(Math.round(el.scrollLeft / cardWidth));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [briefings.length]);

  if (briefings.length === 1) {
    return <BriefingCard briefing={briefings[0]} showIndicator={false} indicator={null} />;
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="overflow-x-auto snap-x snap-mandatory flex no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {briefings.map((b, i) => (
          <div key={b.pet.id} className="snap-start flex-shrink-0 w-full">
            <BriefingCard
              briefing={b}
              showIndicator={true}
              indicator={
                <Indicator total={briefings.length} active={i === activeIdx ? i : activeIdx} />
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Indicator({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i === active ? 'bg-gray-800' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// 단일 펫 카드
// ────────────────────────────────────────────────
function BriefingCard({
  briefing,
  showIndicator,
  indicator,
}: {
  briefing: PetBriefing;
  showIndicator: boolean;
  indicator: React.ReactNode;
}) {
  const ageLabel = formatAge(briefing.age);
  const meta = [ageLabel, briefing.pet.weight ? `${briefing.pet.weight}kg` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <PetAvatar />
          <p className="text-sm font-bold text-gray-800 truncate">
            {briefing.pet.name}
            {meta && <span className="text-[10px] font-medium text-gray-400 ml-1.5">{meta}</span>}
          </p>
        </div>
        {showIndicator && indicator}
      </div>

      {/* 본문 */}
      <div className="px-4 pb-3.5 pt-1 space-y-1.5">
        <HighlightBox briefing={briefing} />
        <MetricRows briefing={briefing} />
      </div>
    </div>
  );
}

// 동적 강조 박스 — 1개만 표시 (생일/예약/기록). 강조 없으면 null.
function HighlightBox({ briefing }: { briefing: PetBriefing }) {
  const { highlight, pet } = briefing;
  if (highlight.type === 'birthday') {
    return (
      <div className="rounded-xl bg-rose-50 px-3 py-2 flex items-center gap-2">
        <Cake size={14} className="text-rose-600 flex-shrink-0" />
        <p className="text-[12px] text-rose-700 font-bold">
          오늘 {pet.name} 생일이에요! 축하해요 🎂
        </p>
      </div>
    );
  }
  if (highlight.type === 'appointment') {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2 flex items-center gap-2">
        <Calendar size={14} className="text-amber-600 flex-shrink-0" />
        <p className="text-[12px] text-amber-700 font-bold">
          예약 D-{highlight.daysUntilAppointment} ·{' '}
          {formatShortDate(briefing.nextAppointmentDate!)}
        </p>
      </div>
    );
  }
  if (highlight.type === 'inactive') {
    return (
      <div className="rounded-xl bg-blue-50 px-3 py-2 flex items-center gap-2">
        <MessageSquare size={14} className="text-blue-600 flex-shrink-0" />
        <p className="text-[12px] text-blue-700 font-bold">
          {highlight.daysSinceLastRecord}일째 기록이 없어요 — 오늘 {pet.name}는 어땠나요?
        </p>
      </div>
    );
  }
  return null;
}

// 평소 메트릭 2줄
function MetricRows({ briefing }: { briefing: PetBriefing }) {
  const { daysSinceLastRecord, nextAppointmentDate, highlight } = briefing;

  // 강조 박스가 inactive 면 마지막 기록은 위로 합쳐졌으니 메트릭에서 생략
  // 강조 박스가 appointment 면 예약은 합쳐졌으니 생략
  const showLastRecord = highlight.type !== 'inactive';
  const showNextAppt = highlight.type !== 'appointment';

  return (
    <>
      {showLastRecord && (
        <div className="flex items-center gap-2 text-[12px] text-gray-700">
          <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
          {daysSinceLastRecord !== null ? (
            <span>
              마지막 기록 <span className="font-bold">{daysSinceLastRecord}일 전</span>
            </span>
          ) : (
            <span className="text-gray-400">아직 기록 없음</span>
          )}
        </div>
      )}
      {showNextAppt && (
        <div className="flex items-center gap-2 text-[12px] text-gray-700">
          <Calendar size={13} className="text-gray-400 flex-shrink-0" />
          {nextAppointmentDate ? (
            <span>
              다음 예약 <span className="font-bold">{formatShortDate(nextAppointmentDate)}</span>
            </span>
          ) : (
            <span className="text-gray-400">예약 없음</span>
          )}
        </div>
      )}
    </>
  );
}

// 펫 아바타 — lucide PawPrint 아이콘 + 그린 배경 (건강 기록 톤과 일관)
function PetAvatar() {
  return (
    <span className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
      <PawPrint size={14} className="text-green-700" />
    </span>
  );
}

// YYYY-MM-DD → "12/15" (월/일)
function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}
