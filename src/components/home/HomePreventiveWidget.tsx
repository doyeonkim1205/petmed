'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Syringe, ChevronDown, ChevronRight } from 'lucide-react';
import { usePreventiveCares } from '@/hooks/usePreventiveCares';
import type { PreventiveCare } from '@/lib/supabase';
import { categoryMeta, careStatus, ddayLabel, ddayFrom, type CareStatus } from '@/lib/preventiveCare';

// 홈 "예방 관리" 위젯 — 평소엔 한 줄 요약, 탭하면 다가오는 예방 리스트로 펼침.
// D-7 이내(임박·지남 포함) 예방이 있을 때만 노출 (없으면 자동 숨김 → 홈 깔끔).
// 페이지 '임박' 표시(D-7)·당일/3일전 푸시와 일관. 전체 항목은 예방 페이지에서 확인.
// 완료 처리는 날짜 확인이 필요해 위젯에선 안 하고, 탭하면 예방 관리 페이지로 이동.

const HORIZON_DAYS = 7;

const badgeCls: Record<CareStatus, string> = {
  overdue: 'text-red-600 bg-red-50',
  soon: 'text-amber-600 bg-amber-50',
  ok: 'text-gray-400 bg-gray-50',
};

export function HomePreventiveWidget() {
  const [cares, setCares] = useState<PreventiveCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { getUpcoming } = usePreventiveCares();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getUpcoming(); // next_due 오름차순
      // D-7 이내(지난 것 포함)만 노출. 임박한 게 없으면 위젯 자체가 숨겨짐 → 홈 깔끔.
      // (멀리 있는 항목은 예방 페이지에서 확인 — 홈은 '곧 챙길 것'만)
      setCares(all.filter((c) => ddayFrom(c.next_due_date) <= HORIZON_DAYS));
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'preventive', action: 'home-widget-load' } });
    } finally {
      setLoading(false);
    }
  }, [getUpcoming]);

  useEffect(() => { load(); }, [load]);

  // 홈이 다시 보일 때(다른 탭에서 예방 추가 후 복귀 등) 재조회 — Next.js 라우터 캐시로
  // 위젯이 재마운트되지 않아 추가한 항목이 안 보이던 문제 방지.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  if (loading) return null;
  if (cares.length === 0) return null;

  const top = cares[0];
  const topStatus = careStatus(top.next_due_date);
  const topMeta = categoryMeta(top.category);
  const summary = cares.length === 1
    ? `${topMeta.label} ${ddayLabel(top.next_due_date)}`
    : `${topMeta.label} 외 ${cares.length - 1}개 예정`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      {/* 접힌 상태 — 한 줄 요약 */}
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-none">
          <Syringe size={18} className="text-sky-500" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900">예방 관리</p>
          <p className="text-[11px] text-gray-400 truncate">{summary}</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex-none ${badgeCls[topStatus]}`}>
          {ddayLabel(top.next_due_date)}
        </span>
        <ChevronDown size={16} className={`text-gray-400 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* 펼친 상태 — 다가오는 예방 리스트 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {cares.map((c) => {
            const meta = categoryMeta(c.category);
            const st = careStatus(c.next_due_date);
            return (
              <button
                key={c.id}
                onClick={() => router.push('/records/preventive')}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-none text-base">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate">
                    {meta.label}
                    {c.pets?.name ? <span className="text-gray-400 font-normal"> · {c.pets.name}</span> : null}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-none ${badgeCls[st]}`}>
                  {ddayLabel(c.next_due_date)}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => router.push('/records/preventive')}
            className="mt-1 w-full flex items-center justify-center gap-0.5 py-2 text-[12px] font-medium text-sky-600 hover:text-sky-700 transition-colors"
          >
            예방 관리 <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
