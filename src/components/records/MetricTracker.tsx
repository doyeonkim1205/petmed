'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Droplet, Utensils, Syringe } from 'lucide-react';
import { supabase, type Pet } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import {
  METRIC_META,
  metricTargetRange,
  metricTargetHint,
  type HealthMetric,
  type MetricType,
} from '@/lib/healthMetrics';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';
type Daily = { date: string; value: number };

// ─── 일별 막대 차트 + 적정범위 밴드 ──────────────────────
function MetricBarChart({ data, target, color }: { data: Daily[]; target: { low: number; high: number } | null; color: string }) {
  if (data.length === 0) return null;
  const W = 320, H = 168, PX = 36, PY = 14, PB = 20;
  const chartW = W - PX * 2;
  const chartH = H - PY - PB;
  const maxV = Math.max(...data.map((d) => d.value), target?.high || 0) * 1.12 || 1;
  const yOf = (v: number) => PY + chartH - (v / maxV) * chartH;
  const n = data.length;
  const slot = chartW / n;
  const bw = Math.max(2, Math.min(slot * 0.62, 22));
  const labelCount = Math.min(5, n);
  const labelIdx = Array.from({ length: labelCount }, (_, i) => Math.round((i * (n - 1)) / Math.max(labelCount - 1, 1)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '190px' }}>
      {[0, 0.5, 1].map((r) => {
        const y = PY + chartH - r * chartH;
        return (
          <g key={r}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{Math.round(r * maxV)}</text>
          </g>
        );
      })}
      {/* 적정범위 밴드 + 기준선 */}
      {target && (
        <>
          <rect x={PX} y={yOf(target.high)} width={chartW} height={Math.max(yOf(target.low) - yOf(target.high), 1)} fill={color} opacity="0.12" />
          <line x1={PX} y1={yOf(target.low)} x2={W - PX} y2={yOf(target.low)} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
        </>
      )}
      {/* 막대 (적정범위 벗어나면 경고색) */}
      {data.map((d, i) => {
        const cx = PX + slot * i + slot / 2;
        const y = yOf(d.value);
        const out = target && (d.value < target.low || d.value > target.high);
        return <rect key={i} x={cx - bw / 2} y={y} width={bw} height={Math.max(PY + chartH - y, 0)} rx="2" fill={out ? '#f59e0b' : color} />;
      })}
      {labelIdx.map((idx) => (
        <text key={idx} x={PX + slot * idx + slot / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="#9ca3af">
          {new Date(data[idx].date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

export function MetricTracker({
  userId,
  pet,
  metricType,
  period,
  startDate,
  endDate,
}: {
  userId: string;
  pet: Pet;
  metricType: MetricType;
  period: Period;
  startDate: Date;
  endDate: Date;
}) {
  const meta = METRIC_META[metricType];
  const MetricIcon = metricType === 'water' ? Droplet : metricType === 'food' ? Utensils : Syringe;
  const [logs, setLogs] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('pet_id', pet.id)
      .eq('metric_type', metricType)
      .order('measured_at', { ascending: true });
    setLogs((data as HealthMetric[]) || []);
    setLoading(false);
  }, [pet.id, metricType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const target = useMemo(() => metricTargetRange(metricType, pet.type, pet.weight || 0), [metricType, pet.type, pet.weight]);

  // 기간 필터 + 날짜별 합산 → 기간에 따라 평균 버킷팅
  const daily = useMemo<Daily[]>(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      const d = String(log.measured_at).split('T')[0];
      const dt = new Date(d);
      if (dt >= startDate && dt <= endDate) map.set(d, (map.get(d) || 0) + Number(log.value));
    }
    let arr = [...map.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
    // 장기간: 주/월 평균 (일별 막대 과다 방지)
    if (arr.length > 31 && period !== 'month') {
      const buckets = new Map<string, { sum: number; n: number; date: string }>();
      for (const d of arr) {
        const key = period === '3month' ? String(Math.floor(new Date(d.date).getTime() / (7 * 86400000))) : d.date.substring(0, 7);
        const b = buckets.get(key) || { sum: 0, n: 0, date: d.date };
        b.sum += d.value; b.n += 1; b.date = d.date;
        buckets.set(key, b);
      }
      arr = [...buckets.values()].map((b) => ({ date: b.date, value: Math.round(b.sum / b.n) }));
    }
    return arr;
  }, [logs, startDate, endDate, period]);

  // 오늘 총량 + 기간 일평균
  const todayStr = todayLocalISO();
  const todayTotal = useMemo(() => logs.filter((l) => String(l.measured_at).split('T')[0] === todayStr).reduce((s, l) => s + Number(l.value), 0), [logs, todayStr]);
  const avg = daily.length > 0 ? Math.round(daily.reduce((s, d) => s + d.value, 0) / daily.length) : 0;
  const todayPct = target && todayTotal > 0 ? Math.round((todayTotal / ((target.low + target.high) / 2)) * 100) : null;

  const handleAdd = async () => {
    // 최대 5자리 + 소수점 2자리 (예: 99999.99)
    const v = Math.round(Math.min(Math.max(0, Number(newValue) || 0), 99999.99) * 100) / 100;
    if (!v) return;
    const date = newDate > todayStr ? todayStr : newDate;
    setSaving(true);
    await supabase.from('health_metrics').insert({ user_id: userId, pet_id: pet.id, metric_type: metricType, value: v, unit: meta.unit, measured_at: date });
    setNewValue('');
    setShowInput(false);
    setSaving(false);
    fetchLogs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('health_metrics').delete().eq('id', id);
    setSelectedId(null);
    fetchLogs();
  };

  const recent = useMemo(() => [...logs].reverse().slice(0, 30), [logs]);

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">불러오는 중…</div>;
  }

  return (
    <div className="space-y-3">
      {/* 요약 카드 */}
      <div className="rounded-xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-400">오늘 {meta.label}</p>
          <p className="text-lg font-bold text-gray-800">{todayTotal > 0 ? `${todayTotal}${meta.unit}` : '-'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 break-keep break-words">{metricTargetHint(metricType, target)}</p>
        </div>
        <div className="text-right">
          {todayPct !== null && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${todayPct < 80 ? 'bg-amber-100 text-amber-600' : todayPct > 120 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              권장 대비 {todayPct}%
            </span>
          )}
          <p className="text-[11px] text-gray-400 mt-1">기간 일평균 {avg > 0 ? `${avg}${meta.unit}` : '-'}</p>
        </div>
      </div>

      {/* 그래프 */}
      {daily.length >= 1 ? (
        <div className="rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2">{meta.label} 추세</h2>
          <MetricBarChart data={daily} target={target} color={meta.color} />
          {target && (
            <p className="text-[10px] text-gray-400 text-center mt-2 break-keep break-words">
              연한 띠 = 적정 범위({target.low}~{target.high}{meta.unit}) · 벗어난 날은 주황 막대 · 참고용이며 개체차가 있어요
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 py-8 text-center">
          <MetricIcon size={32} className="mx-auto text-gray-300 mb-1.5" />
          <p className="text-sm text-gray-400 break-keep break-words">아직 {meta.label} 기록이 없어요</p>
        </div>
      )}

      {/* 입력 */}
      {showInput ? (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: meta.color + '55', background: meta.color + '0d' }}>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder={meta.placeholder}
              value={newValue}
              onChange={(e) => {
                const v = e.target.value;
                // 정수 최대 5자리 + 소수점 둘째자리까지
                if (v === '' || /^\d{0,5}(\.\d{0,2})?$/.test(v)) setNewValue(v);
              }}
              autoComplete="off"
              className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 bg-white"
            />
            <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-1 min-w-0"
              inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
          <p className="text-[11px] text-gray-400 break-keep break-words">하루에 여러 번 입력하면 그날 총량으로 합산돼요</p>
          <div className="flex gap-2">
            <button onClick={() => setShowInput(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">취소</button>
            <button onClick={handleAdd} disabled={!newValue || saving} className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: meta.color }}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl text-sm font-medium transition-colors"
          style={{ borderColor: meta.color + '66', color: meta.color }}>
          <Plus size={16} /> {meta.label} 기록
        </button>
      )}

      {/* 내역 */}
      {recent.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-gray-700 mb-2">기록 내역</h2>
          {recent.map((log) => {
            const isSel = selectedId === log.id;
            return (
              <div key={log.id}
                onClick={() => setSelectedId(isSel ? null : log.id)}
                className={`flex items-center justify-between py-2.5 px-2 border-b border-gray-50 rounded-lg transition-colors ${isSel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                <span className="text-xs text-gray-400">{new Date(log.measured_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{Number(log.value)}{log.unit}</span>
                  {isSel && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                      className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium">삭제</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
