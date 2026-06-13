'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, StickyNote } from 'lucide-react';
import { supabase, type Pet, type ExcretionKind, type ExcretionLog } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/TimePicker';
import { todayLocalISO, localDateKey } from '@/lib/date';
import {
  conditionsFor, conditionMeta, amountLabel, colorMeta,
  AMOUNTS, POOP_COLORS, isAbnormalCondition,
} from '@/lib/excretion';

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

const KIND_LABEL: Record<ExcretionKind, string> = { poop: '대변', pee: '소변' };

// 날짜(YYYY-MM-DD) + 시각(HH:MM) → ISO timestamp.
function buildMeasuredAt(dateISO: string, timeHHMM: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const dateKey = (iso: string) => localDateKey(iso);

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
  const [newTime, setNewTime] = useState(nowHHMM());
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
  const resetInput = () => { setCondition(''); setAmount(''); setColor(''); setMemo(''); setNewDate(todayLocalISO()); setNewTime(nowHHMM()); };
  useEffect(() => { setShowInput(false); resetInput(); }, [kind]);

  const todayStr = todayLocalISO();
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    const t = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return dateKey(iso) === todayStr ? `오늘 ${t}` : `${d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} ${t}`;
  };
  const fmtDateHeader = (dateK: string) => {
    if (dateK === todayStr) return '오늘';
    if (dateK === yesterdayStr) return '어제';
    return new Date(`${dateK}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // 기간 내 로그
  const inRange = useMemo(() => logs.filter((l) => {
    const dt = new Date(`${dateKey(l.measured_at)}T00:00:00`);
    return dt >= startDate && dt <= endDate;
  }), [logs, startDate, endDate]);

  const todayCount = useMemo(() => logs.filter((l) => dateKey(l.measured_at) === todayStr).length, [logs, todayStr]);
  const abnormalCount = useMemo(() => inRange.filter((l) => isAbnormalCondition(kind, l.condition)).length, [inRange, kind]);
  // 마지막 기록 (logs 는 시간 오름차순 → 맨 뒤가 최신)
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

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
      measured_at: buildMeasuredAt(date, newTime),
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

  // 최근 40건을 날짜별로 묶음 (날짜 내림차순, 같은 날 안에서도 최신순)
  const grouped = useMemo(() => {
    const recent = [...logs].reverse().slice(0, 40);
    const out: { date: string; items: ExcretionLog[] }[] = [];
    const idx = new Map<string, { date: string; items: ExcretionLog[] }>();
    for (const l of recent) {
      const k = dateKey(l.measured_at);
      let g = idx.get(k);
      if (!g) { g = { date: k, items: [] }; idx.set(k, g); out.push(g); }
      g.items.push(l);
    }
    return out;
  }, [logs]);
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
          {/* 요약 — 오늘 횟수 + 마지막 기록(상태·시각) + 이상 pill(있을 때만) */}
          <div className="rounded-xl border border-gray-100 p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">오늘 {KIND_LABEL[kind]}</p>
              <p className="text-lg font-bold text-gray-800">{todayCount > 0 ? `${todayCount}회` : '-'}</p>
              {lastLog && (
                <p className="text-[11px] text-gray-400 mt-0.5 inline-flex items-center gap-1">
                  마지막
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: conditionMeta(kind, lastLog.condition).color }} />
                  {conditionMeta(kind, lastLog.condition).label} · {fmtWhen(lastLog.measured_at)}
                </p>
              )}
            </div>
            {abnormalCount > 0 && (
              <span className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">주의 {abnormalCount}회</span>
            )}
          </div>

          {/* 입력 */}
          {showInput ? (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: accent + '55', background: accent + '0d' }}>
              {/* 상태 (필수) */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">상태 <span className="text-rose-400">*</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {conds.map((o) => (
                    <button key={o.id} type="button" onClick={() => setCondition(condition === o.id ? '' : o.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${condition === o.id ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-gray-200 text-gray-600'}`}>
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
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${amount === o.id ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white border border-gray-200 text-gray-500'}`}>
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
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${color === o.id ? 'bg-blue-50 text-blue-600 border-blue-200' : 'border-gray-200 text-gray-500 bg-white'}`}>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: o.color }} />{o.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 메모 (선택) */}
              <input type="search" placeholder="메모 (선택)" value={memo}
                onChange={(e) => setMemo(e.target.value)} maxLength={100} autoComplete="off"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white appearance-none outline-none focus:ring-2 focus:ring-gray-300 [&::-webkit-search-cancel-button]:hidden" />

              {/* 날짜 · 시간 (현재 시각 자동 채움 + 수정 가능) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 flex-shrink-0">날짜</span>
                  <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-1 min-w-0"
                    inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 flex-shrink-0">시간</span>
                  <div className="flex-1 min-w-0"><TimePicker value={newTime} onChange={setNewTime} minuteStep={1} /></div>
                </div>
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

          {/* 내역 — 날짜별로 묶고, 각 줄엔 시간만 */}
          {grouped.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700">기록 내역</h2>
              {grouped.map((g) => (
                <div key={g.date}>
                  <p className="text-[11px] font-bold text-gray-400 mb-1">{fmtDateHeader(g.date)}</p>
                  <div className="space-y-0.5">
                    {g.items.map((log) => {
                      const isSel = selectedId === log.id;
                      const cm = conditionMeta(kind, log.condition);
                      const am = amountLabel(log.amount);
                      const cl = colorMeta(log.color);
                      return (
                        <div key={log.id} onClick={() => setSelectedId(isSel ? null : log.id)}
                          className={`flex items-center justify-between py-2 px-2 rounded-lg transition-colors ${isSel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{fmtTime(log.measured_at)}</span>
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
                            {log.memo && (
                              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1"><StickyNote size={11} className="flex-shrink-0" /><span className="truncate">{log.memo}</span></p>
                            )}
                          </div>
                          {isSel && (
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                              className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium flex-shrink-0 ml-2">삭제</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
