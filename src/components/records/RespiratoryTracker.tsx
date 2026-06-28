'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Wind, Timer, AlertTriangle } from 'lucide-react';
import { supabase, type Pet } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/TimePicker';
import { todayLocalISO, localDateKey } from '@/lib/date';
import type { HealthMetric } from '@/lib/healthMetrics';

const REF_LINE = 30; // 수면·안정 시 참고 기준(회/분) — 개·고양이 공통 모니터링 기준
const CONDITIONS = ['sleeping', 'resting', 'afterActivity', 'other'] as const;
type Condition = (typeof CONDITIONS)[number];
const TIMER_SECONDS = 30; // 30초 카운트 × 2 = 분당 호흡수
const ACCENT = '#818CF8'; // 인디고 블루 (indigo-400)

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 분당 호흡수 단계 — 진단 아님, 수면·안정 시 참고 기준.
 *  <12 측정확인 / 12~14 낮은편 / 15~30 참고범위 / 31~34 약간높음 / 35~39 다소높음 / 40+ 상담권고 */
function grade(bpm: number): 'verylow' | 'low' | 'normal' | 'watch' | 'high' | 'vet' {
  if (bpm >= 40) return 'vet';
  if (bpm >= 35) return 'high';
  if (bpm >= 31) return 'watch';
  if (bpm >= 15) return 'normal';
  if (bpm >= 12) return 'low';
  return 'verylow';
}
const GRADE_COLOR: Record<string, string> = {
  verylow: '#64748b', low: '#64748b', normal: '#16a34a', watch: '#d97706', high: '#ea580c', vet: '#dc2626',
};

/** 점·선 차트(체중 차트 스타일) — y축 값 라벨 + x축 날짜 + 30회/분 참고선. */
function RespChart({ data }: { data: { key: string; v: number }[] }) {
  if (data.length === 0) return null;
  const W = 320, H = 170, PX = 34, PY = 18, PB = 22;
  const chartW = W - PX * 2, chartH = H - PY - PB;
  const vals = data.map((d) => d.v);
  const minV = Math.min(...vals, REF_LINE);
  const maxV = Math.max(...vals, REF_LINE);
  const range = (maxV - minV) || 1;
  const yOf = (v: number) => PY + chartH - ((v - minV) / range) * chartH;
  const xOf = (i: number) => data.length === 1 ? PX + chartW / 2 : PX + (i / (data.length - 1)) * chartW;
  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.v) }));
  const fmtMD = (key: string) => { const p = key.split('-'); return `${+p[1]}/${+p[2]}`; };
  const labelIdx = data.length <= 5
    ? data.map((_, i) => i)
    : Array.from({ length: 5 }, (_, i) => Math.round(i * (data.length - 1) / 4));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '190px' }}>
      {/* y축 그리드 + 값 라벨 (min / mid / max) */}
      {[0, 0.5, 1].map((r) => {
        const y = PY + chartH - r * chartH;
        return (
          <g key={r}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{Math.round(minV + r * range)}</text>
          </g>
        );
      })}
      {/* 참고선 30회/분 */}
      <line x1={PX} y1={yOf(REF_LINE)} x2={W - PX} y2={yOf(REF_LINE)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
      {data.length >= 2 && (
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={data.length > 20 ? 2 : 4} fill={ACCENT} stroke="#fff" strokeWidth={data.length > 20 ? 1 : 2} />
      ))}
      {labelIdx.map((idx) => (
        <text key={idx} x={xOf(idx)} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">{fmtMD(data[idx].key)}</text>
      ))}
    </svg>
  );
}

type Period = 'month' | '3month' | 'year' | 'all' | 'custom';

export function RespiratoryTracker({
  userId, pet, period, startDate, endDate,
}: {
  userId: string;
  pet: Pet;
  period: Period;
  startDate: Date;
  endDate: Date;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [logs, setLogs] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');
  const [condition, setCondition] = useState<Condition>('sleeping');
  const [newDate, setNewDate] = useState(todayLocalISO());
  const [newTime, setNewTime] = useState(nowHHMM());
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30); // 리스트 "더보기" 30건씩

  // 타이머 측정 상태: idle(버튼) → ready(시작 대기) → running(카운트다운)
  const [timerPhase, setTimerPhase] = useState<'idle' | 'ready' | 'running'>('idle');
  const [secLeft, setSecLeft] = useState(TIMER_SECONDS);
  const [taps, setTaps] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('pet_id', pet.id)
      .eq('metric_type', 'respiratory')
      .order('measured_at', { ascending: true });
    setLogs((data as HealthMetric[]) || []);
    setLoading(false);
  }, [pet.id]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 타이머 정리
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const openTimer = () => {
    setTaps(0);
    setSecLeft(TIMER_SECONDS);
    setTimerPhase('ready');
  };
  const startTimer = () => {
    setTaps(0);
    setSecLeft(TIMER_SECONDS);
    setTimerPhase('running');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerPhase('idle');
          // 30초 카운트 × 2 = 분당 호흡수. 최신 taps 는 콜백 밖에서 반영.
          setTaps((tc) => { setValue(String(Math.min(tc * 2, 120))); return tc; });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerPhase('idle');
  };

  // 차트: 안정 시(자는중/쉬는중)만 대상 + 버킷별 "최고값(MAX)". 활동후·기타는 리스트엔 있지만 차트 제외.
  //   구간: 1개월·3개월=일별 / 1년=주별 / 전체=월별 (대표일자 = 라벨용 YYYY-MM-DD).
  const chartData = useMemo(() => {
    const gran: 'day' | 'week' | 'month' = period === 'year' ? 'week' : period === 'all' ? 'month' : 'day';
    const buckets = new Map<string, { key: string; v: number }>();
    for (const l of logs) {
      if (l.memo !== 'sleeping' && l.memo !== 'resting') continue; // 안정 시만
      const dt = new Date(l.measured_at);
      if (dt < startDate || dt > endDate) continue;
      const dk = localDateKey(String(l.measured_at));
      let bkey: string, repDate: string;
      if (gran === 'day') { bkey = dk; repDate = dk; }
      else if (gran === 'week') { const d = new Date(`${dk}T00:00:00`); d.setDate(d.getDate() - d.getDay()); repDate = localDateKey(d.toISOString()); bkey = repDate; }
      else { const [y, m] = dk.split('-'); repDate = `${y}-${m}-01`; bkey = `${y}-${m}`; }
      const v = Number(l.value);
      const cur = buckets.get(bkey);
      if (!cur || v > cur.v) buckets.set(bkey, { key: repDate, v });
    }
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [logs, startDate, endDate, period]);

  // 리스트: 최근 visibleCount 건을 날짜별로 그룹 (식사/수액과 동일, "더보기" 30건씩). 모든 상태 표시.
  const grouped = useMemo(() => {
    const recent = [...logs].reverse().slice(0, visibleCount);
    const out: { date: string; items: HealthMetric[] }[] = [];
    const idx = new Map<string, { date: string; items: HealthMetric[] }>();
    for (const l of recent) {
      const k = localDateKey(String(l.measured_at));
      let g = idx.get(k);
      if (!g) { g = { date: k, items: [] }; idx.set(k, g); out.push(g); }
      g.items.push(l);
    }
    return out;
  }, [logs, visibleCount]);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDate = (k: string) => new Date(k).toLocaleDateString(locale, { month: 'long', day: 'numeric' });

  // 미래 시각 여부 — 안내 + 저장 비활성화용 (미래는 "아직 안 한 측정"이라 막음).
  const isFutureTime = !!newDate && !!newTime && new Date(`${newDate}T${newTime}:00`).getTime() > Date.now();

  const handleAdd = async () => {
    const v = Math.round(Number(value));
    if (!v || v < 1 || v > 120) return;
    const measuredDate = new Date(`${newDate}T${newTime || '00:00'}:00`);
    if (measuredDate.getTime() > Date.now()) return; // 백스톱 (버튼은 이미 비활성)
    setSaving(true);
    const measuredAt = measuredDate.toISOString();
    await supabase.from('health_metrics').insert({
      user_id: userId, pet_id: pet.id, metric_type: 'respiratory',
      value: v, unit: t('resp.unit'), memo: condition, measured_at: measuredAt,
    });
    setValue(''); setCondition('sleeping'); setShowInput(false); setSaving(false);
    setNewDate(todayLocalISO()); setNewTime(nowHHMM());
    fetchLogs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('health_metrics').delete().eq('id', id);
    setSelectedId(null);
    fetchLogs();
  };

  const previewGrade = value && Number(value) >= 1 ? grade(Number(value)) : null;

  return (
    <div className="space-y-4">
      {/* 안내 + 참고 기준 */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
        <p className="text-[13px] font-bold text-indigo-800 flex items-center gap-1.5"><Wind size={14} /> {t('resp.refTitle')}</p>
        <p className="text-[11px] text-indigo-700/80 mt-1 leading-relaxed break-keep whitespace-pre-line">{t('resp.refDesc')}</p>
      </div>

      {/* 입력 토글 — 다른 지표 추가 버튼과 동일한 점선 스타일 */}
      {!showInput && (
        <button onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl text-sm font-medium transition-colors"
          style={{ borderColor: '#3730a366', color: '#3730a3' }}>
          <Plus size={16} /> {t('resp.add')}
        </button>
      )}

      {showInput && (
        <div className="border border-gray-200 rounded-xl p-3.5 space-y-3">
          {/* 타이머 측정 — idle: 버튼 / ready: 시작 대기 / running: 카운트다운 */}
          {timerPhase === 'idle' && (
            <button onClick={openTimer}
              className="w-full py-2.5 rounded-lg bg-indigo-50 text-indigo-800 text-sm font-bold flex items-center justify-center gap-1.5">
              <Timer size={16} /> {t('resp.timerStart', { sec: TIMER_SECONDS })}
            </button>
          )}
          {timerPhase === 'ready' && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
              <p className="text-[12px] text-indigo-700 leading-relaxed break-keep">{t('resp.timerReady', { sec: TIMER_SECONDS })}</p>
              <button onClick={startTimer}
                className="w-full mt-3 py-3 rounded-xl text-white font-bold text-sm" style={{ background: ACCENT }}>
                {t('resp.timerStartNow')}
              </button>
              <button onClick={stopTimer} className="text-[11px] text-gray-400 mt-2 underline">{t('common.cancel')}</button>
            </div>
          )}
          {timerPhase === 'running' && (
            <div className="rounded-lg p-4 text-center bg-white border-2" style={{ borderColor: ACCENT }}>
              <p className="text-[11px]" style={{ color: ACCENT }}>{t('resp.timerHint')}</p>
              <p className="text-3xl font-extrabold my-1 tabular-nums" style={{ color: ACCENT }}>{secLeft}s</p>
              <button onClick={() => setTaps((c) => c + 1)}
                className="w-full mt-1 py-4 rounded-xl text-white font-bold text-lg active:opacity-90" style={{ background: ACCENT }}>
                {t('resp.timerTap')} · {taps}
              </button>
              <button onClick={stopTimer} className="text-[11px] text-gray-400 mt-2 underline">{t('common.cancel')}</button>
            </div>
          )}

          {/* 직접/결과 입력 */}
          <div>
            <label className="text-[11px] text-gray-400">{t('resp.valueLabel')}</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" inputMode="numeric" min={1} max={120} value={value}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d{0,4}$/.test(v)) setValue(v); }}
                placeholder={t('resp.placeholder')}
                style={{ ['--tw-ring-color' as string]: ACCENT + '66' }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2" />
              <span className="text-sm text-gray-500">{t('resp.unit')}</span>
            </div>
            {previewGrade && (
              <p className="text-[12px] font-medium mt-1.5" style={{ color: GRADE_COLOR[previewGrade] }}>
                {t(`resp.grade.${previewGrade}`)}
              </p>
            )}
          </div>

          {/* 측정 상태 */}
          <div>
            <label className="text-[11px] text-gray-400">{t('resp.conditionLabel')}</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CONDITIONS.map((c) => (
                <button key={c} onClick={() => setCondition(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${condition === c ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                  {t(`resp.condition.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 → 시간 (세로) */}
          <div className="flex flex-col gap-2">
            <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
            <TimePicker value={newTime} onChange={setNewTime} accentColor={ACCENT} />
          </div>

          {isFutureTime && <p className="text-[12px] text-red-500">{t('stats.futureTime')}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowInput(false); stopTimer(); setValue(''); }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium">{t('common.cancel')}</button>
            <button onClick={handleAdd} disabled={saving || !value || Number(value) < 1 || isFutureTime}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: ACCENT }}>{t('common.save')}</button>
          </div>
        </div>
      )}

      {/* 차트 — 안정 시(자는중/쉬는중) 기록만, 버킷별 최고값 */}
      {!loading && (chartData.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <h2 className="text-sm font-bold text-gray-700 mb-1">{t('resp.chartTitle')}</h2>
          <RespChart data={chartData} />
          <p className="text-[10px] text-gray-300 mt-1">{t('resp.chartNote')}</p>
        </div>
      ) : logs.length > 0 ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-[12px] text-gray-400 break-keep">{t('resp.chartEmpty')}</p>
        </div>
      ) : null)}

      {/* 최근 기록 리스트 */}
      {loading ? (
        <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Wind size={36} className="mx-auto mb-2 text-gray-200" />
          <p className="text-gray-400 text-sm">{t('resp.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold text-gray-700">{t('stats.history')} <span className="text-[11px] font-normal text-gray-400">· {t('stats.tapToDelete')}</span></h2>
          {grouped.map((g) => (
            <div key={g.date}>
              <p className="text-[11px] font-bold text-gray-400 mb-1">{fmtDate(g.date)}</p>
              <div className="space-y-0.5">
                {g.items.map((l) => {
                  const gr = grade(Number(l.value));
                  const isSel = selectedId === l.id;
                  return (
                    <div key={l.id} onClick={() => setSelectedId(isSel ? null : l.id)}
                      className={`flex items-center justify-between py-2 px-2 rounded-lg transition-colors cursor-pointer ${isSel ? 'bg-red-50' : 'active:bg-gray-50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{fmtTime(String(l.measured_at))}</span>
                        <span className="text-sm font-semibold" style={{ color: GRADE_COLOR[gr] }}>{Number(l.value)}{t('resp.unit')}</span>
                        {l.memo && (CONDITIONS as readonly string[]).includes(l.memo) && (
                          <span className="text-[11px] text-gray-400 truncate">· {t(`resp.condition.${l.memo}`)}</span>
                        )}
                      </div>
                      {isSel && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                          className="px-2.5 py-1 bg-red-500 text-white text-[11px] rounded-full font-medium flex-shrink-0 ml-2">{t('common.delete')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {logs.length > visibleCount && (
            <button onClick={() => setVisibleCount((c) => c + 30)}
              className="w-full py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg">
              {t('stats.showMore')}
            </button>
          )}
        </div>
      )}

      {/* 면책 */}
      <p className="text-[11px] text-gray-400 leading-relaxed flex items-start gap-1 break-keep">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {t('resp.disclaimer')}
      </p>
    </div>
  );
}
