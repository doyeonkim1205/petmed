'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PawPrint, MessageSquare, Calendar, Cake, Heart, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthBriefing, type PetBriefing } from '@/hooks/useHealthBriefing';

// 나이 표시용 — formatAge(lib)는 AI 프롬프트(petContext)에서도 쓰여 한국어 고정이므로,
// UI 는 locale-aware 로 별도 포맷. {unit, count} 만 뽑아 컴포넌트에서 t('home.age.*') 적용.
function ageParts(age: { years: number; months: number; days: number } | null) {
  if (!age) return null;
  if (age.years >= 1) return { unit: 'years' as const, count: age.years };
  if (age.months >= 1) return { unit: 'months' as const, count: age.months };
  return { unit: 'days' as const, count: Math.max(age.days, 0) };
}

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
  const t = useTranslations('home');
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
          <p className="text-sm font-bold text-gray-800 mb-0.5">{t('welcome.title')}</p>
          <p className="text-[11px] font-normal text-gray-500 leading-snug">{t('welcome.subtitle')}</p>
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
  const t = useTranslations('home');
  const first = briefings[0];
  const ap = ageParts(first.age);
  const ageLabel = ap ? t(`age.${ap.unit}`, { count: ap.count }) : '';
  const meta = [ageLabel, first.latestWeight ? `${first.latestWeight}kg` : null]
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
      {/* 본문 — 일반 카드와 같은 2행 형식. pl-9 로 헤더 아바타 라인과 정렬.
          첫 기록 메시지만 강조 (font-bold), 예약 없음은 평소대로 normal. */}
      <div className="pl-9 pr-4 pb-3.5 pt-1 space-y-1.5">
        <div className="flex items-center gap-2 text-[12px] text-gray-700">
          <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
          <span className="font-bold">{t('firstRecord')}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-gray-400 font-normal">
          <Calendar size={13} className="flex-shrink-0" />
          <span>{t('noAppointment')}</span>
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
  const t = useTranslations('home');
  const ap = ageParts(briefing.age);
  const ageLabel = ap ? t(`age.${ap.unit}`, { count: ap.count }) : '';
  const meta = [ageLabel, briefing.latestWeight ? `${briefing.latestWeight}kg` : null]
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
                {t('birthday', { name: briefing.pet.name })}
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

      {/* 본문 — 항상 메트릭 2행 고정. 좌측 padding 을 헤더의 펫 아바타 끝
          (16px + 28px + gap 적당) 에 맞춰 pl-9 (36px) — 헤더와 시각적 정렬. */}
      <div className="pl-9 pr-4 pb-3.5 pt-1 space-y-1.5">
        <LastRecordRow briefing={briefing} />
        <NextAppointmentRow briefing={briefing} />
      </div>
    </div>
  );
}

// 마지막 기록 행 — daysSinceLastRecord 만으로 독립 판단 (highlight 의존 X).
// 카드 전체 톤 통일 (gray). 강조는 텍스트 메시지 + 아이콘 차별로.
//   - 0일 (오늘): gray + bold + Check 아이콘 + "오늘 기록 완료" — 완료 의미 명확
//   - 1~6일: gray normal + 말풍선 + "N일 전"
//   - 7일+ (포함): gray normal + 말풍선 + "N일째 기록이 없어요 — 오늘 ... 어땠나요?"
//   - 기록 없음: gray + "아직 기록 없음"
function LastRecordRow({ briefing }: { briefing: PetBriefing }) {
  const t = useTranslations('home');
  const { daysSinceLastRecord, pet } = briefing;
  if (daysSinceLastRecord !== null && daysSinceLastRecord >= 7) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-gray-700">
        <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
        <span>
          {t('noRecordSince', { count: daysSinceLastRecord, name: pet.name })}
        </span>
      </div>
    );
  }
  if (daysSinceLastRecord === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-gray-700 font-bold">
        <Check size={13} className="text-gray-500 flex-shrink-0" />
        <span>{t('recordedToday')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-gray-700">
      <MessageSquare size={13} className="text-gray-400 flex-shrink-0" />
      {daysSinceLastRecord !== null ? (
        <span>
          {t.rich('lastRecordAgo', {
            count: daysSinceLastRecord,
            b: (chunks) => <span className="font-bold">{chunks}</span>,
          })}
        </span>
      ) : (
        <span className="text-gray-400">{t('noRecordsYet')}</span>
      )}
    </div>
  );
}

// 다음 예약 행 — daysUntilAppointment 만으로 독립 판단 (highlight 의존 X).
//   - D-0 ~ D-3 (당일 포함): orange + bold + "예약 D-N · M/D"
//   - D-4 이상: gray + "다음 예약 M/D"
//   - 없음: gray + "예약 없음"
function NextAppointmentRow({ briefing }: { briefing: PetBriefing }) {
  const t = useTranslations('home');
  const { nextAppointmentDate, daysUntilAppointment } = briefing;
  if (
    daysUntilAppointment !== null &&
    daysUntilAppointment <= 3 &&
    nextAppointmentDate
  ) {
    // D-0 (당일) → "D-Day" 로 강조. D-1, D-2, D-3 은 그대로. (D-표기는 언어 중립)
    const dLabel = daysUntilAppointment === 0 ? 'D-Day' : `D-${daysUntilAppointment}`;
    return (
      <div className="flex items-center gap-2 text-[12px] text-orange-600 font-bold">
        <Calendar size={13} className="text-orange-500 flex-shrink-0" />
        <span>
          {t('appointmentSoon', { dLabel, date: formatShortDate(nextAppointmentDate) })}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-gray-700">
      <Calendar size={13} className="text-gray-400 flex-shrink-0" />
      {nextAppointmentDate ? (
        <span>
          {t.rich('nextAppointment', {
            date: formatShortDate(nextAppointmentDate),
            b: (chunks) => <span className="font-bold">{chunks}</span>,
          })}
        </span>
      ) : (
        <span className="text-gray-400">{t('noAppointment')}</span>
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
