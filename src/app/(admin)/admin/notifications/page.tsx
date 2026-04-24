'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/TextField';
import { Send, Users, Crown, UserCheck, History, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

type TargetKey = 'all' | 'plus' | 'free';
interface RecentSend {
  id: string;
  created_at: string;
  details: { title?: string; body?: string; target?: string; sent?: number; failed?: number };
}
interface Stats {
  subscriberCounts: Record<TargetKey, { total: number; subscribed: number }>;
  recentSends: RecentSend[];
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
              {stats.recentSends.map((row) => {
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
        </CardContent>
      </Card>
    </div>
  );
}
