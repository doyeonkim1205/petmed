'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/TextField';
import { Send, Users, Crown, UserCheck, History, AlertCircle, Activity, Smartphone } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { Pagination } from '@/components/admin/Pagination';

const SENDS_PER_PAGE = 5;

type TargetKey = 'all' | 'plus' | 'free';
interface RecentSend {
  id: string;
  created_at: string;
  details: { title?: string; body?: string; target?: string; sent?: number; failed?: number };
}
interface Diagnostics {
  cron24h: { runs: number; sent: number; failed: number };
  cronHealth: {
    lastRunAt: string | null;
    status: 'healthy' | 'lagging' | 'dead' | 'unknown';
  };
  providerCounts: { fcm: number; apple: number; mozilla: number; other: number };
  ghostCandidates: Array<{ id: string; email: string | null }>;
}
interface Stats {
  subscriberCounts: Record<TargetKey, { total: number; subscribed: number }>;
  recentSends: RecentSend[];
  diagnostics?: Diagnostics;
}

export default function NotificationsPage() {
  const [target, setTarget] = useState<'all' | 'plus' | 'free' | 'user'>('all');
  const [userEmail, setUserEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [sendPage, setSendPage] = useState(1);

  const loadStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/notifications/stats');
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSend = async () => {
    if (!title || !body) { setResult('제목과 내용을 입력해주세요.'); return; }
    if (target === 'user' && !userEmail) { setResult('이메일을 입력해주세요.'); return; }
    if (!confirm(`${target === 'all' ? '전체' : target === 'user' ? userEmail : target} 사용자에게 알림을 보내시겠습니까?`)) return;

    setSending(true);
    setResult('');
    try {
      const res = await authFetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, userEmail: target === 'user' ? userEmail : undefined, title, body, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if ((data.sent ?? 0) === 0 && (data.failed ?? 0) === 0) {
        setResult('⚠️ 대상자 중 알림을 켠 사용자가 없어 아무에게도 발송되지 않았어요');
      } else {
        setResult(`✅ 발송 완료: ${data.sent}건 성공, ${data.failed}건 실패`);
      }
      setTitle('');
      setBody('');
      // 발송 직후 내역 + 알림 켠 사용자 수 리로드
      loadStats();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'admin', action: 'push-send' },
        extra: { target, userEmail: userEmail ? '(provided)' : undefined },
      });
      setResult(`❌ ${err instanceof Error ? err.message : '발송 실패'}`);
    } finally {
      setSending(false);
    }
  };

  const subscriberDesc = (key: TargetKey): string => {
    if (!stats) return '';
    const { total, subscribed } = stats.subscriberCounts[key];
    return `${total}명 중 ${subscribed}명 알림 켬`;
  };

  const targets = [
    { value: 'all', label: '전체', icon: Users, desc: stats ? subscriberDesc('all') : '모든 사용자' },
    { value: 'plus', label: 'Plus', icon: Crown, desc: stats ? subscriberDesc('plus') : '유료 사용자만' },
    { value: 'free', label: 'Free', icon: UserCheck, desc: stats ? subscriberDesc('free') : '무료 사용자만' },
    { value: 'user', label: '특정 사용자', icon: Send, desc: '이메일로 지정' },
  ];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">푸시 알림 발송</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">대상 선택</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {targets.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.value} onClick={() => setTarget(t.value as typeof target)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    target === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <Icon size={18} className={target === t.value ? 'text-blue-500' : 'text-gray-400'} />
                  <div>
                    <p className={`text-sm font-medium ${target === t.value ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              );
            })}
            {target === 'user' && (
              <input type="email" placeholder="사용자 이메일" value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">알림 내용</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">제목</label>
              <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="알림 제목"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">내용</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="알림 내용" rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">클릭 시 이동 URL</label>
              <TextField value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            {/* Preview */}
            {title && (
              <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                <p className="text-xs text-gray-400 mb-1">미리보기</p>
                <p className="text-sm font-bold text-gray-800">{title}</p>
                <p className="text-xs text-gray-600">{body}</p>
              </div>
            )}

            {result && <p className="text-sm">{result}</p>}

            <button onClick={handleSend} disabled={sending}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={14} />
              {sending ? '발송 중...' : '알림 발송'}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* 최근 발송 내역 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History size={14} className="text-gray-400" />
            최근 발송 내역 {stats && <span className="text-xs text-gray-400 font-normal">({stats.recentSends.length}건)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats && <p className="text-sm text-gray-400">로딩 중...</p>}
          {stats && stats.recentSends.length === 0 && (
            <p className="text-sm text-gray-400">아직 발송 내역이 없어요</p>
          )}
          {stats && stats.recentSends.length > 0 && (
            <div className="space-y-3">
              {stats.recentSends.slice((sendPage - 1) * SENDS_PER_PAGE, sendPage * SENDS_PER_PAGE).map((row) => {
                const d = row.details || {};
                const zero = (d.sent ?? 0) === 0 && (d.failed ?? 0) === 0;
                const targetLabel =
                  d.target === 'all' ? '전체' :
                  d.target === 'plus' ? 'Plus' :
                  d.target === 'free' ? 'Free' :
                  d.target === 'user' ? '개별' : (d.target || '-');
                return (
                  <div key={row.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {targetLabel}
                        </span>
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {d.title || '(제목 없음)'}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{formatDate(row.created_at)}</span>
                    </div>
                    {d.body && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{d.body}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px]">
                      {zero ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertCircle size={11} />
                          알림 켠 사람 없음 — 아무에게도 전달 안 됨
                        </span>
                      ) : (
                        <>
                          <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            성공 {d.sent ?? 0}건
                          </span>
                          {(d.failed ?? 0) > 0 && (
                            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              실패 {d.failed}건
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {stats && stats.recentSends.length > SENDS_PER_PAGE && (
            <Pagination
              page={sendPage}
              totalPages={Math.ceil(stats.recentSends.length / SENDS_PER_PAGE)}
              onChange={setSendPage}
            />
          )}
        </CardContent>
      </Card>

      {/* 진단 카드 — 푸시 시스템 건강 */}
      {stats?.diagnostics && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity size={14} className="text-gray-400" />
              푸시 시스템 진단
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* cron 건강 상태 — pg_cron 의 마지막 실행 기준 */}
            {(() => {
              const h = stats.diagnostics.cronHealth;
              const dot = h.status === 'healthy' ? 'bg-green-500' : h.status === 'lagging' ? 'bg-amber-500' : h.status === 'dead' ? 'bg-red-500' : 'bg-gray-300';
              const label = h.status === 'healthy' ? '정상 가동 중' : h.status === 'lagging' ? '실행 지연' : h.status === 'dead' ? '실행 멈춤' : '확인 불가';
              const labelColor = h.status === 'healthy' ? 'text-green-700' : h.status === 'lagging' ? 'text-amber-700' : h.status === 'dead' ? 'text-red-700' : 'text-gray-500';
              const lastRun = h.lastRunAt ? (() => {
                const ms = Date.now() - new Date(h.lastRunAt).getTime();
                const m = Math.floor(ms / 60000);
                const s = Math.floor((ms % 60000) / 1000);
                if (m < 1) return `${s}초 전`;
                if (m < 60) return `${m}분 전`;
                const hr = Math.floor(m / 60);
                return hr < 24 ? `${hr}시간 전` : `${Math.floor(hr / 24)}일 전`;
              })() : '기록 없음';
              return (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${h.status === 'healthy' ? 'bg-green-50' : h.status === 'lagging' ? 'bg-amber-50' : h.status === 'dead' ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <span className={`w-2 h-2 rounded-full ${dot} ${h.status === 'healthy' ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-medium ${labelColor}`}>cron {label}</span>
                  <span className="text-[11px] text-gray-400 ml-auto">마지막 실행: {lastRun}</span>
                </div>
              );
            })()}

            {/* 24시간 발송 활동 — 빈 분(sent=0,failed=0)은 기록 안 하므로 작은 숫자 정상 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">최근 24시간 발송 활동</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-400">활동 분</p>
                  <p className="text-sm font-bold text-gray-700">{stats.diagnostics.cron24h.runs.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-green-600">발송 성공</p>
                  <p className="text-sm font-bold text-green-700">{stats.diagnostics.cron24h.sent.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-red-600">발송 실패</p>
                  <p className="text-sm font-bold text-red-700">{stats.diagnostics.cron24h.failed.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 제공자별 분포 */}
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Smartphone size={12} />
                구독 기기 분포 (현재)
              </p>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-blue-600">FCM (안드/크롬)</p>
                  <p className="text-sm font-bold text-blue-700">{stats.diagnostics.providerCounts.fcm}</p>
                </div>
                <div className="bg-gray-100 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-600">Apple (iOS/Mac)</p>
                  <p className="text-sm font-bold text-gray-700">{stats.diagnostics.providerCounts.apple}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-orange-600">Mozilla</p>
                  <p className="text-sm font-bold text-orange-700">{stats.diagnostics.providerCounts.mozilla}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-500">기타</p>
                  <p className="text-sm font-bold text-gray-600">{stats.diagnostics.providerCounts.other}</p>
                </div>
              </div>
            </div>

            {/* 유령 후보 */}
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                <AlertCircle size={12} className={stats.diagnostics.ghostCandidates.length > 0 ? 'text-amber-500' : 'text-gray-300'} />
                알림 켰지만 구독 없음
                <span className="text-[11px] text-gray-400 font-normal">— 유령 상태 의심 (앱 다시 열면 자동 복구)</span>
              </p>
              {stats.diagnostics.ghostCandidates.length === 0 ? (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-center">없음 ✅</p>
              ) : (
                <div className="space-y-1">
                  {stats.diagnostics.ghostCandidates.map((g) => (
                    <div key={g.id} className="text-xs bg-amber-50 border border-amber-100 rounded-md px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-amber-700 truncate">{g.email || g.id}</span>
                      <span className="text-[10px] text-amber-500 flex-shrink-0">유령 의심</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
