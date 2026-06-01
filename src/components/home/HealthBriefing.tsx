'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { PawPrint, MessageSquare, Calendar, Cake, Heart, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthBriefing, type PetBriefing } from '@/hooks/useHealthBriefing';
import { formatAge } from '@/lib/healthBriefing';

/**
 * 홈 "건강 브리핑" 카드 — 기존 HealthTip 자리.
 *
 * 디자인 원칙:
 *   - 강조 박스 없음 → 텍스트 색/볼드만으로 강조 (앱 톤 일관성)
 *   - 카드 본문은 항상 메트릭 2행 (마지막 기록 + 다음 예약) 고정 → 카드 높이 균일
 *   - 생일은 헤더 안 두 번째 줄로 (메트릭 행에 영향 없음)
 *
 * 동적 강조 (pickHighlight in lib):
 *   - 생일 당일 → 헤더 두 번째 줄 (rose)
 *   - 예약 D-3 이내 → "다음 예약" 메트릭 행 (amber + bold + "D-N · M/D")
 *   - 기록 7일 초과 → "마지막 기록" 메트릭 행 (blue + bold + "N일째 기록 없어요")
 *   - 마지막 기록 0일 → "오늘 기록 완료" (green, 긍정 톤)
 */
export function HealthBriefing() {
  const { user } = useAuth();
  const { briefings, petsCount, loading } = useHealthBriefing(user?.id);

  if (loading) {
    return <div className="rounded-2xl bg-white border border-gray-100 h-[88px]" />;
  }

  if (petsCount === 0) {
    return <WelcomeCard />;
  }

  const allRecordsEmpty = briefings.every((b) => b.daysSinceLastRecord === null);
  if (allRecordsEmpty) {
    return <FirstRecordCard briefings={briefings} />;
  }

  return <BriefingSlider briefings={briefings} />;
}

// ────────────────────────────────────────────────
// 환영 카드 (펫 0마리)
// 카드 전체 클릭 → /profile (펫 등록). 우측 chevron 으로 affordance.
// ────────────────────────────────────────────────
function WelcomeCard() {
  return (
    <Link
      href="/profile"
      className="block rounded-2xl bg-white border border-gray-100 px-4 py-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <PawPrint size={18} className="text-blue-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 mb-0.5">소중한 가족을 등록해주세요</p>
          <p className="text-[11px] text-gray-500 leading-snug">PawDex 와 함께해요</p>
        </div>
        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────
// 첫 기록 CTA (펫 있음, 기록 0)
// 일반 펫 카드와 같은 2행 레이아웃 (헤더 + 본문 2줄). 카드 전체 클릭 → /records/add.
// → 슬라이드 시 다른 펫 카드와 높이 동일. 시각적 일관성.
// ────────────────────────────────────────────────
function FirstRecordCard({ briefings }: { briefings: PetBriefing[] }) {
  const first = briefings[0];
  const ageLabel = formatAge(first.age);
  const meta = [ageLabel, first.pet.weight ? `${first.pet.weight}kg` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link
      href="/records/add"
      className="block rounded-2xl bg-white border border-gray-100 overflow-hidden active:scale-[0.99] transition-transform"
    >
      {/* 헤더 — 펫 정보 + chevron */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <PetAvatar />
          <p className="text-sm font-bold text-gray-800 truncate">
            {first.pet.name}
            {meta && <span className="text-[10px] font-medium text-gray-400 ml-1.5">{meta}</span>}
          </p>
        </div>
        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
      </div>
      {/* 본문 — 일반 카드와 같은 2행 형식 */}
      <div className="px-4 pb-3.5 pt-1 space-y-1.5">
        <div className="flex items-center gap-2 text-[12px] text-gray-700">
          <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
          <span>첫 기록을 남겨볼까요?</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-gray-400">
          <Calendar size={13} className="flex-shrink-0" />
          <span>예약 없음</span>
        </div>
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
    <div
      ref={containerRef}
      className="overflow-x-auto snap-x snap-proximity flex no-scrollbar"
      style={{ scrollbarWidth: 'none' }}
    >
      {briefings.map((b, i) => (
        <div key={b.pet.id} className="snap-start flex-shrink-0 w-full">
          <BriefingCard
            briefing={b}
            showIndicator={true}
            indicator={<Indicator total={briefings.length} active={activeIdx} />}
          />
        </div>
      ))}
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
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      {/* 헤더 — 한 줄.
          평소: 펫 아이콘 + 이름 + (나이 · 체중)
          생일: 펫 아이콘 + "{name}의 생일이에요, 축하합니다!" + Cake 아이콘 (rose 포인트)
          → 생일 당일엔 나이/체중 자리에 메시지가 대체됨. 카드 높이 항상 일정. */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <PetAvatar />
          {briefing.isBirthday ? (
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1 min-w-0">
              <Cake size={14} className="text-rose-500 flex-shrink-0" />
              <span className="truncate">
                {briefing.pet.name}의 소중한 생일을 축하해요
              </span>
              <Heart size={14} className="text-rose-500 fill-rose-500 flex-shrink-0" />
            </p>
          ) : (
            <p className="text-sm font-bold text-gray-800 truncate">
              {briefing.pet.name}
              {meta && (
                <span className="text-[10px] font-medium text-gray-400 ml-1.5">{meta}</span>
              )}
            </p>
          )}
        </div>
        {showIndicator && indicator}
      </div>

      {/* 본문 — 항상 메트릭 2행 고정 */}
      <div className="px-4 pb-3.5 pt-1 space-y-1.5">
        <LastRecordRow briefing={briefing} />
        <NextAppointmentRow briefing={briefing} />
      </div>
    </div>
  );
}

// 마지막 기록 행 — daysSinceLastRecord 만으로 독립 판단 (highlight 의존 X).
// 이유: highlight.type 이 'birthday' 이면 강조 분기를 못 타서 잘못 표시되는 버그 방지.
//   - 0일 (오늘): green + bold + "오늘 기록 완료"
//   - 1~6일: gray + "N일 전"
//   - 7일+ (포함): green + bold + "N일째 기록이 없어요 — 오늘 ... 어땠나요?"
//   - 기록 없음: gray + "아직 기록 없음"
function LastRecordRow({ briefing }: { briefing: PetBriefing }) {
  const { daysSinceLastRecord, pet } = briefing;
  if (daysSinceLastRecord !== null && daysSinceLastRecord >= 7) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-green-700 font-bold">
        <MessageSquare size={13} className="text-green-600 flex-shrink-0" />
        <span>
          {daysSinceLastRecord}일째 기록이 없어요 — 오늘 {pet.name}는 어땠나요?
        </span>
      </div>
    );
  }
  if (daysSinceLastRecord === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-green-700 font-bold">
        <MessageSquare size={13} className="text-green-600 flex-shrink-0" />
        <span>오늘 기록 완료</span>
      </div>
    );
  }
  return (
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
  );
}

// 다음 예약 행 — daysUntilAppointment 만으로 독립 판단 (highlight 의존 X).
//   - D-0 ~ D-3 (당일 포함): orange + bold + "예약 D-N · M/D"
//   - D-4 이상: gray + "다음 예약 M/D"
//   - 없음: gray + "예약 없음"
function NextAppointmentRow({ briefing }: { briefing: PetBriefing }) {
  const { nextAppointmentDate, daysUntilAppointment } = briefing;
  if (
    daysUntilAppointment !== null &&
    daysUntilAppointment <= 3 &&
    nextAppointmentDate
  ) {
    // D-0 (당일) → "D-Day" 로 강조. D-1, D-2, D-3 은 그대로.
    const dLabel = daysUntilAppointment === 0 ? 'D-Day' : `D-${daysUntilAppointment}`;
    return (
      <div className="flex items-center gap-2 text-[12px] text-orange-600 font-bold">
        <Calendar size={13} className="text-orange-500 flex-shrink-0" />
        <span>
          예약 {dLabel} · {formatShortDate(nextAppointmentDate)}
        </span>
      </div>
    );
  }
  return (
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
  );
}

// 펫 아바타 — 앱 메인 톤 (파랑). 건강 기록 섹션(그린) 과 색상 중복 방지.
function PetAvatar() {
  return (
    <span className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
      <PawPrint size={14} className="text-blue-600" />
    </span>
  );
}

// YYYY-MM-DD → "12/15"
function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
