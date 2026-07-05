'use client';

// 특정 수치의 추이 — 같은 analyte_key + 같은 단위만 연결. 누적 대응: 최근/전체 토글, 많으면 라벨 숨김, 요약 한 줄.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterSheet } from '@/components/records/FilterSheet';
import { useLabTests } from '@/hooks/useLabTests';

type Pt = { date: string; value: number; unit: string; refLow: number | null; refHigh: number | null };
const RECENT_N = 8;

function MiniLineChart({ data, showValueLabels, dateStride, width, scroll }: { data: Pt[]; showValueLabels: boolean; dateStride: number; width: number; scroll: boolean }) {
  const W = width, H = 150, padX = 16, padTop = 22, padBottom = 26;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const yOf = (v: number) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);
  const xStep = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({ x: padX + i * xStep, y: yOf(d.value), d }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const mmdd = (s: string) => { const [, m, dd] = s.split('-'); return `${Number(m)}/${Number(dd)}`; };
  const lastIdx = pts.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={scroll ? W : undefined} height={scroll ? H : undefined} className={scroll ? 'block' : 'w-full'} style={{ maxHeight: 170 }}>
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
  const t = useTranslations();
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

  // 점이 촘촘해지면(≈13개+) 가로 스크롤 — 점당 최소 22px 보장해 회차 구분 유지. 최근뷰(8개)는 안 걸림.
  const MIN_STEP = 22, USABLE = 268, PADX = 16;
  const scroll = shown.length > 1 && (shown.length - 1) * MIN_STEP > USABLE;
  const chartW = scroll ? PADX * 2 + (shown.length - 1) * MIN_STEP : 300;

  const round = (n: number) => Math.round(n * 100) / 100;
  const latest = series.length ? series[series.length - 1].value : null;
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const delta = latest != null && prev != null ? round(latest - prev) : null;

  // 참고범위 밴드 — 가장 최근 기록의 양측 참고범위만(다를 수 있어 '최근 기준'). 한쪽/텍스트는 밴드 없음.
  const lastPt = series.length ? series[series.length - 1] : null;
  const band = lastPt && lastPt.refLow != null && lastPt.refHigh != null ? { low: lastPt.refLow, high: lastPt.refHigh } : null;

  return (
    <FilterSheet open title={t('lab.trend.title', { label })} closeLabel={t('common.close')} doneLabel={t('common.close')} onClose={onClose}>
      {data === null ? (
        <div className="h-36 bg-gray-50 rounded-lg flex flex-col items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-[11px] text-gray-400">{t('lab.trend.loading')}</p>
        </div>
      ) : series.length < 2 ? (
        <p className="text-sm text-gray-400 text-center py-8 whitespace-pre-line">{t('lab.trend.needMore')}</p>
      ) : (
        <>
          {/* 요약 한 줄 — 그래프보다 이게 흐름 파악에 더 중요 */}
          <div className="text-center mb-2">
            <p className="text-[14px] text-gray-800">
              {t('lab.trend.latest')} <b className="tabular-nums">{latest}</b>{latestUnit ? ` ${latestUnit}` : ''}
              {delta != null && <span className="text-gray-400 font-normal"> · {t('lab.trend.vsPrev')} {delta >= 0 ? '+' : ''}{delta}</span>}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{range === 'recent' ? t('lab.trend.recentN', { n: shown.length }) : t('lab.trend.allN', { n: series.length })}</p>
          </div>

          {series.length > RECENT_N && (
            <div className="flex justify-center gap-1 mb-2">
              {(['recent', 'all'] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${range === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {r === 'recent' ? t('lab.trend.recent') : t('lab.trend.all')}
                </button>
              ))}
            </div>
          )}

          <div className={scroll ? 'overflow-x-auto' : ''}>
            <MiniLineChart data={shown} showValueLabels={showValueLabels} dateStride={dateStride} width={chartW} scroll={scroll} />
          </div>
          {scroll && <p className="text-[10px] text-gray-300 text-center mt-0.5">{t('lab.trend.scrollHint')}</p>}

          {band && (
            <p className="text-[11px] text-gray-400 text-center mt-1">{t('lab.trend.refBand', { range: `${band.low}–${band.high}` })}</p>
          )}
          {excluded > 0 && <p className="text-[11px] text-amber-500 text-center mt-1.5">{t('lab.trend.excluded', { n: excluded })}</p>}
        </>
      )}
    </FilterSheet>
  );
}
