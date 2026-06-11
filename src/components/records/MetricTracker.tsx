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
      {/* 막대 — 지표 색 (적정범위는 띠로만 표시) */}
      {data.map((d, i) => {
        const cx = PX + slot * i + slot / 2;
        const y = yOf(d.value);
        return <rect key={i} x={cx - bw / 2} y={y} width={bw} height={Math.max(PY + chartH - y, 0)} rx="2" fill={color} />;
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
  const [loggedWeight, setLoggedWeight] = useState<number | null>(null);

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

  // 적정량 기준 체중 — weight_logs(체중 기록 탭) + health_records(기록장 체중) 중 가장 최근 값,
  //   둘 다 없으면 펫 프로필(pets.weight). 어디에 입력해도 적정량이 뜨도록.
  useEffect(() => {
    (async () => {
      const [wl, rec] = await Promise.all([
        supabase.from('weight_logs').select('weight, measured_at').eq('pet_id', pet.id).gt('weight', 0).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('health_records').select('weight, visit_date').eq('pet_id', pet.id).gt('weight', 0).order('visit_date', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const cands: { w: number; d: string }[] = [];
      if (wl.data) cands.push({ w: Number((wl.data as { weight: number }).weight), d: String((wl.data as { measured_at: string }).measured_at).split('T')[0] });
      if (rec.data) cands.push({ w: Number((rec.data as { weight: number }).weight), d: String((rec.data as { visit_date: string }).visit_date).split('T')[0] });
      cands.sort((a, b) => b.d.localeCompare(a.d));
      setLoggedWeight(cands.length ? cands[0].w : null);
    })();
  }, [pet.id]);
  const effWeight = loggedWeight ?? (pet.weight || 0);
  const target = useMemo(() => metricTargetRange(metricType, pet.type, effWeight), [metricType, pet.type, effWeight]);

  const todayStr = todayLocalISO();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // 기간 내 날짜별 합산 (입력 있는 날만)
  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      const key = String(log.measured_at).split('T')[0];
      const dt = new Date(`${key}T00:00:00`);
      if (dt >= startDate && dt <= endDate) map.set(key, (map.get(key) || 0) + Number(log.value));
    }
    return map;
  }, [logs, startDate, endDate]);

  // 차트용 — 달력 연속(빈 날도 칸 유지). 1개월=일별 / 3개월=주평균 / 그 외=월평균. (한국=DST 없음 → 86400000ms=1일 안전)
  const daily = useMemo<Daily[]>(() => {
    if (dayTotals.size === 0) return [];
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    // 데이터 있는 첫 날부터 시작 — 그 이전 빈 구간(기간 시작~첫 기록)은 안 그림.
    const firstLogged = new Date(`${[...dayTotals.keys()].sort()[0]}T00:00:00`);
    if (firstLogged > start) start.setTime(firstLogged.getTime());
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const end = (endDate < todayD ? new Date(endDate) : todayD); end.setHours(0, 0, 0, 0);
    if (end < start) return [];
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const gran: 'day' | 'week' | 'month' =
      period === 'month' ? 'day'
        : period === '3month' ? 'week'
          : period === 'custom' ? (spanDays <= 45 ? 'day' : spanDays <= 180 ? 'week' : 'month')
            : 'month';
    const out: Daily[] = [];
    if (gran === 'day') {
      for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
        const key = ymd(new Date(t));
        out.push({ date: key, value: Math.round(dayTotals.get(key) || 0) });
      }
    } else if (gran === 'week') {
      const ws = new Date(start); ws.setDate(ws.getDate() - ws.getDay()); // 그 주 일요일
      for (let t = ws.getTime(); t <= end.getTime(); t += 7 * 86400000) {
        let sum = 0, cnt = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(t + i * 86400000);
          if (d < start || d > end) continue;
          const v = dayTotals.get(ymd(d));
          if (v != null) { sum += v; cnt += 1; }
        }
        out.push({ date: ymd(new Date(t)), value: cnt ? Math.round(sum / cnt) : 0 });
      }
    } else {
      let my = start.getFullYear(), mm = start.getMonth();
      while (my < end.getFullYear() || (my === end.getFullYear() && mm <= end.getMonth())) {
        let sum = 0, cnt = 0;
        for (const [key, v] of dayTotals) {
          const d = new Date(`${key}T00:00:00`);
          if (d.getFullYear() === my && d.getMonth() === mm) { sum += v; cnt += 1; }
        }
        out.push({ date: `${my}-${String(mm + 1).padStart(2, '0')}-01`, value: cnt ? Math.round(sum / cnt) : 0 });
        mm += 1; if (mm > 11) { mm = 0; my += 1; }
      }
    }
    return out;
  }, [dayTotals, startDate, endDate, period]);

  // 오늘 총량 + 기간 일평균(입력한 날 기준 — 빈 날 제외)
  const todayTotal = useMemo(() => logs.filter((l) => String(l.measured_at).split('T')[0] === todayStr).reduce((s, l) => s + Number(l.value), 0), [logs, todayStr]);
  const avg = useMemo(() => {
    const vals = [...dayTotals.values()];
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }, [dayTotals]);
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
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="rounded-xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-400">오늘 {meta.label}</p>
          <p className="text-lg font-bold text-gray-800">{todayTotal > 0 ? `${todayTotal}${meta.unit}` : '-'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 break-keep break-words">{metricTargetHint(metricType, target)}</p>
        </div>
        <div className="text-right">
          {todayPct !== null && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${todayPct < 80 || todayPct > 120 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              권장 대비 {todayPct}%
            </span>
          )}
          <p className="text-[11px] text-gray-400 mt-1">기간 일평균 {avg > 0 ? `${avg}${meta.unit}` : '-'}</p>
        </div>
      </div>

      {/* 그래프 */}
      {dayTotals.size > 0 ? (
        <div className="rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2">{meta.label} 추세</h2>
          <MetricBarChart data={daily} target={target} color={meta.color} />
          {target && (
            <p className="text-[10px] text-gray-400 text-center mt-2 break-keep break-words">
              연한 띠 = 적정 범위({target.low}~{target.high}{meta.unit}) · 참고용이며 개체차가 있어요
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
