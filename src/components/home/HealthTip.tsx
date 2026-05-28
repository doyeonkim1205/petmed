'use client';

import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { HEALTH_TIPS } from '@/data/healthTips';

/**
 * 홈 "오늘의 건강 팁" 카드 (정보 표시 전용 — 클릭 동작 없음).
 *
 * 날짜(일 단위)로 팁을 결정해 매일 자동 로테이션.
 * SSR 프리렌더 시 항상 첫 팁으로 렌더 → 마운트 후 오늘의 팁으로 교체(하이드레이션 불일치 방지).
 */
export function HealthTip() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const dayIndex = Math.floor(Date.now() / 86_400_000); // 일 단위 인덱스
    setIdx(dayIndex % HEALTH_TIPS.length);
  }, []);

  const tip = HEALTH_TIPS[idx];

  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white shadow-sm border border-gray-100">
      <span className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Lightbulb size={18} className="text-amber-500" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] text-gray-400 font-medium">오늘의 건강 팁</span>
        <span className="block text-xs font-semibold text-gray-700 leading-snug line-clamp-2">{tip}</span>
      </span>
    </div>
  );
}
