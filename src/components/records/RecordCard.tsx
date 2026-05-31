'use client';

import { useRef } from 'react';
import { HealthRecord, DailySubKind } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit, Building2, PawPrint } from 'lucide-react';

// 일상 세부 종류 한글 라벨. RecordCard 에서 sub_entries 텍스트 표시용.
const DAILY_SUB_LABEL: Record<DailySubKind, string> = {
  meal: '식사', hydration: '수분', walk: '산책', poop: '배변', mood: '기분', other: '기타',
};

interface RecordCardProps {
  record: HealthRecord;
  onClick: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** 카드를 길게 누르면 호출 — 부모가 selectMode 진입 + 해당 카드 선택 처리 */
  onLongPress?: (id: string) => void;
}

const typeConfig = {
  symptom: { icon: AlertCircle, label: '증상', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400' },
  visit: { icon: Stethoscope, label: '진료', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  hospitalization: { icon: Building2, label: '입퇴원', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  manual: { icon: FileEdit, label: '수동', color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  daily: { icon: PawPrint, label: '일상', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
};

// 500ms = Material Design 의 표준 long-press 시간. 짧은 탭과 명확히 구분되면서
// 사용자가 답답함을 못 느끼는 임계점.
const LONG_PRESS_MS = 500;
// 손가락이 5px 이상 움직이면 스크롤 의도로 판단해 long-press 취소.
const MOVE_THRESHOLD = 5;

export function RecordCard({ record, onClick, selectMode, selected, onSelect, onLongPress }: RecordCardProps) {
  const config = typeConfig[record.record_type] || typeConfig.manual;
  const Icon = config.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleClick = () => {
    if (selectMode && onSelect) {
      onSelect(record.id);
    } else {
      onClick();
    }
  };

  // long-press 상태:
  // - timerRef: 발화 예약 타이머
  // - firedRef: long-press 발화됐는지 (true 면 뒤따르는 click 무시)
  // - startRef: 시작 좌표 (이동 임계 비교용)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = (x: number, y: number) => {
    if (selectMode || !onLongPress) return;
    startRef.current = { x, y };
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      // 햅틱 피드백 (지원 기기에서만 — Android Chrome / TWA OK, iOS Safari 미지원)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      onLongPress(record.id);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const moveLongPress = (x: number, y: number) => {
    if (!startRef.current) return;
    const dx = Math.abs(x - startRef.current.x);
    const dy = Math.abs(y - startRef.current.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) cancelLongPress();
  };

  return (
    <div
      onClick={(e) => {
        // long-press 가 발화됐으면 click 은 무시 (의도가 선택이지 진입이 아님).
        if (firedRef.current) {
          firedRef.current = false;
          e.preventDefault();
          return;
        }
        handleClick();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        startLongPress(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        moveLongPress(t.clientX, t.clientY);
      }}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onMouseDown={(e) => startLongPress(e.clientX, e.clientY)}
      onMouseMove={(e) => moveLongPress(e.clientX, e.clientY)}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      className={`rounded-xl p-4 border cursor-pointer transition-colors select-none ${
        selectMode && selected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-100 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {selectMode && (
          <div className="flex items-center justify-center flex-shrink-0 pt-1">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
              }`}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
        )}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
              {config.label}
            </span>
            {record.pets && (
              <span className="text-[11px] text-gray-400">{record.pets.name}</span>
            )}
            <span className="text-[11px] text-gray-300 ml-auto flex-shrink-0">
              {formatDate(record.visit_date)}
            </span>
          </div>
          <h3 className="font-semibold text-sm text-gray-800 line-clamp-1">
            {record.record_type === 'daily'
              ? `${record.pets?.name ?? ''}의 일상 기록`
              : record.title}
          </h3>
          {record.record_type === 'daily' ? (
            record.sub_entries && record.sub_entries.length > 0 ? (
              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                {/* 같은 sub_kind 여러 entry 도 라벨은 1번만 (가독성). 등장 순서 유지. */}
                {Array.from(new Set(record.sub_entries.map((e) => e.sub_kind)))
                  .map((k) => DAILY_SUB_LABEL[k])
                  .join(' · ')}
              </p>
            ) : null
          ) : record.description ? (
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{record.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
