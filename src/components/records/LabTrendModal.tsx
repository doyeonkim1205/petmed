'use client';

// 특정 수치의 추이 — 같은 analyte_key + 같은 단위만 연결. 누적 대응: 최근/전체 토글, 많으면 라벨 숨김, 요약 한 줄.
import { useEffect, useState } from 'react';
import { FilterSheet } from '@/components/records/FilterSheet';
import { useLabTests } from '@/hooks/useLabTests';

type Pt = { date: string; value: number; unit: string };
const RECENT_N = 8;

function MiniLineChart({ data, showValueLabels, dateStride }: { data: Pt[]; showValueLabels: boolean; dateStride: number }) {
  const W = 300, H = 150, padX = 16, padTop = 22, padBottom = 26;
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
  const lastIdx = pts.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={showValueLabels ? 3 : 2.2} fill="#6366f1" />
          {showValueLabels && <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fill="#111827" className="tabular-nums">{p.d.value}</text>}
          {(i % dateStride === 0 || i === lastIdx) && <text x={p.x} y={H - 8} textAnchor="middle" fontSize="8" fill="#9ca3af">{mmdd(p.d.date)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function LabTrendModal({ petId, analyteKey, label, onClose }: { petId: string; analyteKey: string; label: string; onClose: () => void }) {
  const { getAnalyteTrend } = useLabTests();
  const [data, setData] = useState<Pt[] | null>(null);
  const [range, setRange] = useState<'recent' | 'all'>('recent');

  useEffect(() => { getAnalyteTrend(petId, analyteKey).then(setData); }, [petId, analyteKey, getAnalyteTrend]);

  const latestUnit = data && data.length ? data[data.length - 1].unit : '';
  const series = (data || []).filter((d) => d.unit === latestUnit); // 같은 단위만
  const excluded = data ? data.length - series.length : 0;

  const shown = range === 'recent' ? series.slice(-RECENT_N) : series;
  const showValueLabels = shown.length <= 6;         // 7개 이상이면 값 라벨 숨김
  const dateStride = shown.length <= 9 ? 1 : Math.ceil(shown.length / 6); // 10개 이상이면 날짜 일부만

  const round = (n: number) => Math.round(n * 100) / 100;
  const latest = series.length ? series[series.length - 1].value : null;
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const delta = latest != null && prev != null ? round(latest - prev) : null;

  return (
    <FilterSheet open title={`${label} 추이`} closeLabel="닫기" doneLabel="닫기" onClose={onClose}>
      {data === null ? (
        <div className="h-36 bg-gray-50 rounded-lg animate-pulse" />
      ) : series.length < 2 ? (
        <p className="text-sm text-gray-400 text-center py-8">비교할 기록이 더 필요해요.<br />이 수치가 있는 검사가 2회 이상이면 추이를 볼 수 있어요.</p>
      ) : (
        <>
          {/* 요약 한 줄 — 그래프보다 이게 흐름 파악에 더 중요 */}
          <div className="text-center mb-2">
            <p className="text-[14px] text-gray-800">
              최근 <b className="tabular-nums">{latest}</b>{latestUnit ? ` ${latestUnit}` : ''}
              {delta != null && <span className="text-gray-400 font-normal"> · 이전 대비 {delta >= 0 ? '+' : ''}{delta}</span>}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{range === 'recent' ? `최근 ${shown.length}회` : `전체 ${series.length}회`}</p>
          </div>

          {series.length > RECENT_N && (
            <div className="flex justify-center gap-1 mb-2">
              {(['recent', 'all'] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${range === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {r === 'recent' ? '최근' : '전체'}
                </button>
              ))}
            </div>
          )}

          <MiniLineChart data={shown} showValueLabels={showValueLabels} dateStride={dateStride} />

          <p className="text-[11px] text-gray-400 text-center mt-1">단위 {latestUnit || '-'} · 같은 단위 기록만 표시</p>
          {excluded > 0 && <p className="text-[11px] text-amber-500 text-center mt-0.5">단위가 다른 기록 {excluded}건은 제외됐어요.</p>}
          <p className="text-[11px] text-gray-300 text-center mt-2 leading-relaxed">수치 해석은 담당 수의사와 상의하세요.</p>
        </>
      )}
    </FilterSheet>
  );
}
