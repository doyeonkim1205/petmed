'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase, type Pet, type ExcretionKind, type ExcretionLog } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayLocalISO } from '@/lib/date';
import {
  conditionsFor, conditionMeta, amountLabel, colorMeta,
  AMOUNTS, POOP_COLORS, isAbnormalCondition,
} from '@/lib/excretion';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

const KIND_LABEL: Record<ExcretionKind, string> = { poop: '대변', pee: '소변' };

// 날짜(YYYY-MM-DD) + 현재 시각 → ISO timestamp. 오늘이면 사실상 now, 과거면 그 날짜의 현재 시각.
function buildMeasuredAt(dateISO: string): string {
  const now = new Date();
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
}

const dateKey = (iso: string) => iso.split('T')[0];

// ─── 일별 횟수 막대 차트 ─────────────────────
function CountBarChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  if (data.length === 0) return null;
  const W = 320, H = 150, PX = 30, PY = 14, PB = 20;
  const chartW = W - PX * 2;
  const chartH = H - PY - PB;
  const maxV = Math.max(...data.map((d) => d.count), 1) * 1.15;
  const yOf = (v: number) => PY + chartH - (v / maxV) * chartH;
  const n = data.length;
  const slot = chartW / n;
  const bw = Math.max(2, Math.min(slot * 0.6, 20));
  const labelCount = Math.min(5, n);
  const labelIdx = Array.from({ length: labelCount }, (_, i) => Math.round((i * (n - 1)) / Math.max(labelCount - 1, 1)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '170px' }}>
      {[0, 0.5, 1].map((r) => {
        const y = PY + chartH - r * chartH;
        return (
          <g key={r}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PX - 7} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{Math.round(r * maxV)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = PX + slot * i + slot / 2;
        const y = yOf(d.count);
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

export function ExcretionTracker({
  userId, pet, startDate, endDate,
}: {
  userId: string;
  pet: Pet;
  period: Period;
  startDate: Date;
  endDate: Date;
}) {
  const [kind, setKind] = useState<ExcretionKind>('poop');
  const [logs, setLogs] = useState<ExcretionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInput, setShowInput] = useState(false);
  const [condition, setCondition] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [newDate, setNewDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accent = kind === 'poop' ? '#A16207' : '#EAB308';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('excretion_logs')
      .select('*')
      .eq('pet_id', pet.id)
      .eq('kind', kind)
      .order('measured_at', { ascending: true });
    setLogs((data as ExcretionLog[]) || []);
    setLoading(false);
  }, [pet.id, kind]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 입력 폼 초기화 (kind 바뀌면 상태/색 리셋 — 옵션이 다름)
  const resetInput = () => { setCondition(''); setAmount(''); setColor(''); setMemo(''); setNewDate(todayLocalISO()); };
  useEffect(() => { setShowInput(false); resetInput(); }, [kind]);

  const todayStr = todayLocalISO();

  // 기간 내 로그
  const inRange = useMemo(() => logs.filter((l) => {
    const dt = new Date(`${dateKey(l.measured_at)}T00:00:00`);
    return dt >= startDate && dt <= endDate;
  }), [logs, startDate, endDate]);

  const todayCount = useMemo(() => logs.filter((l) => dateKey(l.measured_at) === todayStr).length, [logs, todayStr]);
  const periodCount = inRange.length;
  const abnormalCount = useMemo(() => inRange.filter((l) => isAbnormalCondition(kind, l.condition)).length, [inRange, kind]);

  // 일별 횟수 (기간 내, 기록 있는 날만)
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of inRange) {
      const k = dateKey(l.measured_at);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  }, [inRange]);

  const handleAdd = async () => {
    if (!condition) return;
    const date = newDate > todayStr ? todayStr : newDate;
    setSaving(true);
    await supabase.from('excretion_logs').insert({
      user_id: userId, pet_id: pet.id, kind,
      condition,
      amount: amount || null,
      color: kind === 'poop' ? (color || null) : null,
      memo: memo.trim() || null,
      measured_at: buildMeasuredAt(date),
    });
    setShowInput(false);
    resetInput();
    setSaving(false);
    fetchLogs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('excretion_logs').delete().eq('id', id);
    setSelectedId(null);
    fetchLogs();
  };

  const recent = useMemo(() => [...logs].reverse().slice(0, 40), [logs]);
  const conds = conditionsFor(kind);

  return (
    <div className="space-y-5">
      {/* 대변 / 소변 토글 */}
      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
        {(['poop', 'pee'] as ExcretionKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">불러오는 중…</div>
      ) : (
        <>
          {/* 요약 */}
          <div className="rounded-xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-gray-400">오늘 {KIND_LABEL[kind]}</p>
              <p className="text-lg font-bold text-gray-800">{todayCount > 0 ? `${todayCount}회` : '-'}</p>
            </div>
            <div className="text-right">
              {abnormalCount > 0 && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-600">이상 {abnormalCount}회</span>
              )}
              <p className="text-[11px] text-gray-400 mt-1">기간 {periodCount}회</p>
            </div>
          </div>

          {/* 그래프 */}
          {daily.length > 0 ? (
            <div className="rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-2">{KIND_LABEL[kind]} 횟수</h2>
              <CountBarChart data={daily} color={accent} />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 py-8 text-center">
              <p className="text-sm text-gray-400">아직 {KIND_LABEL[kind]} 기록이 없어요</p>
            </div>
          )}

          {/* 입력 */}
          {showInput ? (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: accent + '55', background: accent + '0d' }}>
              {/* 상태 (필수) */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">상태 <span className="text-rose-400">*</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {conds.map((o) => (
                    <button key={o.id} type="button" onClick={() => setCondition(condition === o.id ? '' : o.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${condition === o.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'}`}
                      style={condition === o.id ? { backgroundColor: o.color } : undefined}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }} />{o.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 양 (선택) */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">양 <span className="text-gray-300">(선택)</span></label>
                <div className="flex gap-1.5">
                  {AMOUNTS.map((o) => (
                    <button key={o.id} type="button" onClick={() => setAmount(amount === o.id ? '' : o.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${amount === o.id ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 색 (대변만, 선택) */}
              {kind === 'poop' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">색 <span className="text-gray-300">(선택)</span></label>
                  <div className="flex flex-wrap gap-1.5">
                    {POOP_COLORS.map((o) => (
                      <button key={o.id} type="button" onClick={() => setColor(color === o.id ? '' : o.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${color === o.id ? 'border-gray-800' : 'border-gray-200 text-gray-500 bg-white'}`}>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: o.color }} />{o.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 메모 (선택) + 날짜 */}
              <div className="flex gap-2">
                <input type="search" placeholder="메모 (선택)" value={memo}
                  onChange={(e) => setMemo(e.target.value)} maxLength={50} autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white appearance-none outline-none focus:ring-2 focus:ring-gray-300 [&::-webkit-search-cancel-button]:hidden" />
                <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-shrink-0 w-32"
                  inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShowInput(false); resetInput(); }} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">취소</button>
                <button onClick={handleAdd} disabled={!condition || saving} className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: accent }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowInput(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl text-sm font-medium transition-colors"
              style={{ borderColor: accent + '66', color: accent }}>
              <Plus size={16} /> {KIND_LABEL[kind]} 기록
            </button>
          )}

          {/* 내역 */}
          {recent.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-gray-700 mb-2">기록 내역</h2>
              {recent.map((log) => {
                const isSel = selectedId === log.id;
                const cm = conditionMeta(kind, log.condition);
                const am = amountLabel(log.amount);
                const cl = colorMeta(log.color);
                const dt = new Date(log.measured_at);
                return (
                  <div key={log.id} onClick={() => setSelectedId(isSel ? null : log.id)}
                    className={`flex items-center justify-between py-2.5 px-2 border-b border-gray-50 rounded-lg transition-colors ${isSel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {dt.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} {dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      <span className="inline-flex items-center gap-1 flex-shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cm.color }} />
                        <span className="text-sm font-semibold text-gray-700">{cm.label}</span>
                      </span>
                      {(am || cl) && (
                        <span className="text-[11px] text-gray-400 truncate">
                          {am ? `· ${am}` : ''}{cl ? ` · ${cl.label}` : ''}
                        </span>
                      )}
                    </div>
                    {isSel && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                        className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium flex-shrink-0">삭제</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
