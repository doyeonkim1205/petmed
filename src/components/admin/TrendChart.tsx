'use client';

/**
 * Admin 대시보드 트래픽 추세용 경량 SVG 막대 차트 (차트 라이브러리 의존성 X).
 *  - data: 시간순 버킷 배열
 *  - 막대 위 hover 시 <title> 로 정확한 값/날짜 표시
 *  - x축 라벨은 최대 ~7개 균등 표시
 */
export function TrendChart({
  data,
  color = '#3B82F6',
  format = (n: number) => n.toLocaleString(),
}: {
  data: { bucket: string; value: number }[];
  color?: string;
  format?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">데이터가 없습니다.</p>;
  }

  const W = 640;
  const H = 220;
  const PADX = 8;
  const PADTOP = 16;
  const PADBOT = 28;
  const chartW = W - PADX * 2;
  const chartH = H - PADTOP - PADBOT;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const slot = chartW / n;
  const barW = Math.max(2, Math.min(slot * 0.7, 40));

  // x축 라벨 ~7개 균등
  const labelCount = Math.min(7, n);
  const labelIdx = new Set(
    Array.from({ length: labelCount }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, labelCount - 1))),
  );

  const fmtLabel = (b: string) => {
    // 'YYYY-MM-DD' → 'M/D'
    const parts = b.split('-');
    return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : b;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '240px' }}>
      {/* 기준선 */}
      <line x1={PADX} y1={PADTOP + chartH} x2={W - PADX} y2={PADTOP + chartH} stroke="#e5e7eb" strokeWidth="1" />
      {/* 최대값 가이드 */}
      <line x1={PADX} y1={PADTOP} x2={W - PADX} y2={PADTOP} stroke="#f3f4f6" strokeWidth="1" />
      <text x={PADX} y={PADTOP - 4} fontSize="9" fill="#9ca3af">{format(maxVal)}</text>

      {data.map((d, i) => {
        const x = PADX + slot * i + (slot - barW) / 2;
        const h = (d.value / maxVal) * chartH;
        const y = PADTOP + chartH - h;
        return (
          <g key={d.bucket}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} opacity={d.value === 0 ? 0.15 : 0.85}>
              <title>{`${d.bucket}: ${format(d.value)}`}</title>
            </rect>
            {labelIdx.has(i) && (
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="#9ca3af">
                {fmtLabel(d.bucket)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
