'use client';

// 특정 수치의 추이 그래프 — 같은 analyte_key + 같은 단위 기록만 선으로 연결.
import { useEffect, useState } from 'react';
import { FilterSheet } from '@/components/records/FilterSheet';
import { useLabTests } from '@/hooks/useLabTests';

type Pt = { date: string; value: number; unit: string };

function MiniLineChart({ data, unit }: { data: Pt[]; unit: string }) {
  const W = 300, H = 150, padX = 14, padTop = 22, padBottom = 26;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const xStep = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: padX + i * xStep,
    y: padTop + (1 - (d.value - min) / range) * (H - padTop - padBottom),
    d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const mmdd = (s: string) => { const [, m, dd] = s.split('-'); return `${Number(m)}/${Number(dd)}`; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#6366f1" />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fill="#111827" className="tabular-nums">{p.d.value}</text>
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="8" fill="#9ca3af">{mmdd(p.d.date)}</text>
        </g>
      ))}
    </svg>
  );
}

export function LabTrendModal({ petId, analyteKey, label, onClose }: { petId: string; analyteKey: string; label: string; onClose: () => void }) {
  const { getAnalyteTrend } = useLabTests();
  const [data, setData] = useState<Pt[] | null>(null);

  useEffect(() => { getAnalyteTrend(petId, analyteKey).then(setData); }, [petId, analyteKey, getAnalyteTrend]);

  const latestUnit = data && data.length ? data[data.length - 1].unit : '';
  const series = (data || []).filter((d) => d.unit === latestUnit);
  const excluded = data ? data.length - series.length : 0;

  return (
    <FilterSheet open title={`${label} 추이`} closeLabel="닫기" doneLabel="닫기" onClose={onClose}>
      {data === null ? (
        <div className="h-36 bg-gray-50 rounded-lg animate-pulse" />
      ) : series.length < 2 ? (
        <p className="text-sm text-gray-400 text-center py-8">추이를 보려면 이 수치가 있는 검사가<br />2회 이상 필요해요.</p>
      ) : (
        <>
          <MiniLineChart data={series} unit={latestUnit} />
          <p className="text-[11px] text-gray-400 text-center mt-1">
            단위 {latestUnit || '-'} · 같은 단위 기록만 표시
          </p>
          {excluded > 0 && <p className="text-[11px] text-amber-500 text-center mt-0.5">단위가 다른 기록 {excluded}건은 제외됐어요.</p>}
          <p className="text-[11px] text-gray-300 text-center mt-2 leading-relaxed">수치 해석은 담당 수의사와 상의하세요.</p>
        </>
      )}
    </FilterSheet>
  );
}
