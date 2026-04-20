'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

const actionLabels: Record<string, string> = {
  'auth.signup': '회원가입',
  'auth.login': '로그인',
  'auth.logout': '로그아웃',
  'profile.update': '프로필 수정',
  'pet.create': '반려동물 추가',
  'pet.delete': '반려동물 삭제',
  'record.create': '기록 추가',
  'record.update': '기록 수정',
  'record.delete': '기록 삭제',
  'record.bulk_delete': '기록 일괄 삭제',
  'analysis.save': '분석 보관',
  'analysis.delete': '분석 삭제',
  'paper.delete': '논문 삭제',
  'subscription.purchase': '구독 결제',
  'subscription.cancel': '구독 해지',
  'symptom.search': '증상 검색',
  'symptom.refine': '증상 재분석',
  'file.upload': '파일 업로드',
  'file.delete': '파일 삭제',
  'admin.push_send': '관리자 알림 발송',
  'push.subscribe': '알림 구독',
  'push.unsubscribe': '알림 해지',
  'admin.plan_change': '관리자 플랜 변경',
  'admin.role_change': '관리자 역할 변경',
  'subscription.refund': '구독 환불',
  'cron.push_notifications': '자동 푸시 알림 cron',
  'cron.expire_subscriptions': '자동 구독 만료 cron',
  'cron.auto_billing': '자동 결제 cron',
};

interface LogProfile {
  id: string;
  email: string;
  nickname: string | null;
}

function formatUser(p: LogProfile | null | undefined) {
  if (!p) return null;
  return p.nickname ? `${p.email} (${p.nickname})` : p.email;
}

// 필터 옵션: 특정 action 또는 카테고리(prefix) 선택
const filterOptions: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'category:cron', label: '시스템 (cron)' },
  { value: 'category:admin', label: '관리자 액션' },
  { value: 'category:auth', label: '인증 (로그인/가입)' },
  { value: 'category:record', label: '기록 CRUD' },
  { value: 'category:pet', label: '반려동물' },
  { value: 'category:subscription', label: '구독' },
  { value: 'category:push', label: '푸시 알림' },
  { value: 'category:symptom', label: '증상 검색' },
  { value: 'category:file', label: '파일' },
  { value: 'category:analysis', label: '분석 보관' },
  { value: 'category:paper', label: '논문' },
  { value: 'action:auth.login', label: '— 로그인만' },
  { value: 'action:auth.signup', label: '— 가입만' },
  { value: 'action:record.create', label: '— 기록 추가만' },
  { value: 'action:admin.plan_change', label: '— 플랜 변경만' },
  { value: 'action:cron.push_notifications', label: '— 푸시 cron 만' },
];

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [datesReady, setDatesReady] = useState(false);

  // 초기 로드: 구독 시작일을 기본 시작일로 설정
  useEffect(() => {
    async function initDates() {
      try {
        const res = await authFetch('/api/admin/activity-logs/date-range');
        const data = await res.json();
        if (data.from) setFrom(data.from);
      } catch {}
      setDatesReady(true);
    }
    initDates();
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!datesReady) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (userId.trim()) params.set('userId', userId.trim());
    if (filter.startsWith('category:')) params.set('category', filter.slice('category:'.length));
    else if (filter.startsWith('action:')) params.set('action', filter.slice('action:'.length));

    const res = await authFetch(`/api/admin/activity-logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [page, from, to, userId, filter, datesReady]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">활동 로그</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleFilter} className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">시작일</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">종료일</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">사용자</label>
              <input type="text" placeholder="이메일 또는 UUID" value={userId} onChange={(e) => setUserId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-52" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">행동</label>
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border rounded-lg text-sm bg-white w-48"
              >
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">검색</button>
            {(from || to || userId || filter) && (
              <button type="button" onClick={() => { setFrom(''); setTo(''); setUserId(''); setFilter(''); setPage(1); }} className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">초기화</button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">총 {total}건</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>행동</TableHead>
                    <TableHead>상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const actor = formatUser(log.actor);
                    const target = formatUser(log.target);
                    const isSystem = !log.user_id;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isSystem ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">시스템</span>
                          ) : actor ? (
                            <div className="space-y-0.5">
                              <div>{actor}</div>
                              {target && <div className="text-xs text-blue-500">→ 대상: {target}</div>}
                            </div>
                          ) : (
                            // 프로필은 없는데 user_id 는 있음 = 탈퇴한 유저
                            <span className="text-xs text-gray-400">
                              탈퇴 유저
                              <span className="ml-1 font-mono text-[10px]">({log.user_id?.slice(0, 8)})</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {actionLabels[log.action] || log.action}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-[300px]">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <details className="cursor-pointer">
                              <summary className="truncate">{Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')}</summary>
                              <pre className="mt-1 text-[10px] bg-gray-50 p-2 rounded overflow-auto max-h-32">{JSON.stringify(log.details, null, 2)}</pre>
                            </details>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">로그가 없습니다.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">페이지 {page} / {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded border disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded border disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
