'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Wind, Timer, X, AlertTriangle } from 'lucide-react';
import { supabase, type Pet } from '@/lib/supabase';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/TimePicker';
import { todayLocalISO } from '@/lib/date';
import type { HealthMetric } from '@/lib/healthMetrics';

const REF_LINE = 30; // 수면·안정 시 참고 기준(회/분)
const CONDITIONS = ['sleeping', 'resting', 'afterActivity', 'other'] as const;
type Condition = (typeof CONDITIONS)[number];
const TIMER_SECONDS = 30; // 30초 카운트 × 2 = 분당 호흡수

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 분당 호흡수 단계 — 진단 아님, 수면·안정 시 참고 기준. */
function grade(bpm: number): 'normal' | 'watch' | 'high' | 'vet' {
  if (bpm >= 40) return 'vet';
  if (bpm >= 35) return 'high';
  if (bpm >= 30) return 'watch';
  return 'normal';
}
const GRADE_COLOR: Record<string, string> = {
  normal: '#16a34a', watch: '#d97706', high: '#ea580c', vet: '#dc2626',
};

/** 간단 막대 차트 + 30회/분 참고선. */
function RespChart({ data, locale }: { data: { d: string; v: number }[]; locale: string }) {
  if (data.length === 0) return null;
  const W = 320, H = 170, PX = 8, PY = 16, PB = 22;
  const chartW = W - PX * 2, chartH = H - PY - PB;
  const maxV = Math.max(REF_LINE + 10, ...data.map((d) => d.v)) * 1.1;
  const yOf = (v: number) => PY + chartH - (v / maxV) * chartH;
  const slot = chartW / data.length;
  const bw = Math.min(slot * 0.55, 22);
  const labelIdx = data.length <= 6 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '190px' }}>
      {/* 참고선 30회/분 */}
      <line x1={PX} y1={yOf(REF_LINE)} x2={W - PX} y2={yOf(REF_LINE)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - PX} y={yOf(REF_LINE) - 3} textAnchor="end" fontSize="9" fill="#94a3b8">{REF_LINE}</text>
      {data.map((d, i) => {
        const cx = PX + slot * i + slot / 2;
        const y = yOf(d.v);
        return <rect key={i} x={cx - bw / 2} y={y} width={bw} height={Math.max(PY + chartH - y, 0)} rx="2" fill={GRADE_COLOR[grade(d.v)]} opacity="0.85" />;
      })}
      {labelIdx.map((idx) => {
        const cx = PX + slot * idx + slot / 2;
        const dt = new Date(data[idx].d);
        const lbl = dt.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
        return <text key={idx} x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">{lbl}</text>;
      })}
    </svg>
  );
}

export function RespiratoryTracker({
  userId, pet, startDate, endDate,
}: {
  userId: string;
  pet: Pet;
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

  // 타이머 측정 상태
  const [timerOn, setTimerOn] = useState(false);
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

  const startTimer = () => {
    setTaps(0);
    setSecLeft(TIMER_SECONDS);
    setTimerOn(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerOn(false);
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
    setTimerOn(false);
  };

  const chartData = useMemo(() => {
    return logs
      .filter((l) => { const dt = new Date(l.measured_at); return dt >= startDate && dt <= endDate; })
      .map((l) => ({ d: l.measured_at, v: Number(l.value) }));
  }, [logs, startDate, endDate]);

  const handleAdd = async () => {
    const v = Math.round(Number(value));
    if (!v || v < 1 || v > 120) return;
    setSaving(true);
    const measuredAt = new Date(`${newDate}T${newTime || '00:00'}:00`).toISOString();
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
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <p className="text-[13px] font-bold text-sky-800 flex items-center gap-1.5"><Wind size={14} /> {t('resp.refTitle')}</p>
        <p className="text-[11px] text-sky-700/80 mt-1 leading-relaxed break-keep">{t('resp.refDesc')}</p>
      </div>

      {/* 입력 토글 */}
      {!showInput && (
        <button onClick={() => setShowInput(true)}
          className="w-full py-2.5 rounded-xl border border-sky-200 text-sky-600 text-sm font-medium flex items-center justify-center gap-1.5">
          <Plus size={16} /> {t('resp.add')}
        </button>
      )}

      {showInput && (
        <div className="border border-gray-200 rounded-xl p-3.5 space-y-3">
          {/* 타이머 측정 */}
          {!timerOn ? (
            <button onClick={startTimer}
              className="w-full py-2.5 rounded-lg bg-sky-100 text-sky-700 text-sm font-bold flex items-center justify-center gap-1.5">
              <Timer size={16} /> {t('resp.timerStart', { sec: TIMER_SECONDS })}
            </button>
          ) : (
            <div className="rounded-lg bg-sky-600 p-4 text-center text-white">
              <p className="text-[11px] opacity-80">{t('resp.timerHint')}</p>
              <p className="text-3xl font-extrabold my-1 tabular-nums">{secLeft}s</p>
              <button onClick={() => setTaps((c) => c + 1)}
                className="w-full mt-1 py-4 rounded-xl bg-white/15 active:bg-white/30 text-white font-bold text-lg">
                {t('resp.timerTap')} · {taps}
              </button>
              <button onClick={stopTimer} className="text-[11px] opacity-70 mt-2 underline">{t('common.cancel')}</button>
            </div>
          )}

          {/* 직접/결과 입력 */}
          <div>
            <label className="text-[11px] text-gray-400">{t('resp.valueLabel')}</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" inputMode="numeric" min={1} max={120} value={value}
                onChange={(e) => setValue(e.target.value)} placeholder={t('resp.placeholder')}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${condition === c ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-gray-200 text-gray-500'}`}>
                  {t(`resp.condition.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜·시간 */}
          <div className="flex gap-2">
            <DatePicker value={newDate} onChange={setNewDate} max={todayLocalISO()} className="flex-1" inputClassName="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
            <TimePicker value={newTime} onChange={setNewTime} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowInput(false); stopTimer(); setValue(''); }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium">{t('common.cancel')}</button>
            <button onClick={handleAdd} disabled={saving || !value || Number(value) < 1}
              className="flex-1 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">{t('common.save')}</button>
          </div>
        </div>
      )}

      {/* 차트 */}
      {!loading && chartData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <h2 className="text-sm font-bold text-gray-700 mb-1">{t('resp.chartTitle')}</h2>
          <RespChart data={chartData} locale={locale} />
        </div>
      )}

      {/* 최근 기록 리스트 */}
      {loading ? (
        <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Wind size={36} className="mx-auto mb-2 text-gray-200" />
          <p className="text-gray-400 text-sm">{t('resp.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-400">{t('metrics.tapToDelete')}</p>
          {[...logs].reverse().map((l) => {
            const g = grade(Number(l.value));
            const dt = new Date(l.measured_at);
            return (
              <button key={l.id} onClick={() => setSelectedId(selectedId === l.id ? null : l.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg text-left">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-bold tabular-nums" style={{ color: GRADE_COLOR[g] }}>{Number(l.value)}</span>
                  <span className="text-[11px] text-gray-400">{t('resp.unit')}</span>
                  {l.memo && (CONDITIONS as readonly string[]).includes(l.memo) && (
                    <span className="text-[11px] text-gray-400">· {t(`resp.condition.${l.memo}`)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{dt.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })} {String(dt.getHours()).padStart(2, '0')}:{String(dt.getMinutes()).padStart(2, '0')}</span>
                  {selectedId === l.id && (
                    <span onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }} className="p-1 text-red-400"><X size={15} /></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 면책 */}
      <p className="text-[11px] text-gray-400 leading-relaxed flex items-start gap-1 break-keep">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {t('resp.disclaimer')}
      </p>
    </div>
  );
}
