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
  // 참고: symptom.search / symptom.refine 은 search_logs 테이블로 이동.
  //      검색 로그 페이지에서 확인 가능.
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

// optgroup 구조로 세분화된 필터. 각 그룹에 '카테고리 전체' + 세부 액션
interface FilterGroup {
  label: string;
  options: { value: string; label: string }[];
}

const filterGroups: FilterGroup[] = [
  {
    label: '특수',
    options: [
      { value: '', label: '전체' },
      { value: 'category:deleted_user', label: '🗑 탈퇴 유저만' },
    ],
  },
  {
    label: '관리자 액션',
    options: [
      { value: 'category:admin', label: '▸ 관리자 액션 전체' },
      { value: 'action:admin.plan_change', label: '플랜 변경' },
      { value: 'action:admin.role_change', label: '역할 변경' },
      { value: 'action:admin.push_send', label: '알림 발송' },
      { value: 'action:admin.refund', label: '환불' },
      { value: 'action:admin.delete-user', label: '유저 삭제' },
    ],
  },
  {
    label: '시스템 (cron)',
    options: [
      { value: 'category:cron', label: '▸ 시스템 전체' },
      { value: 'action:cron.push_notifications', label: '푸시 cron' },
      { value: 'action:cron.expire_subscriptions', label: '구독 만료 cron' },
      { value: 'action:cron.auto_billing', label: '자동 결제 cron' },
    ],
  },
  {
    label: '인증',
    options: [
      { value: 'category:auth', label: '▸ 인증 전체' },
      { value: 'action:auth.login', label: '로그인' },
      { value: 'action:auth.signup', label: '가입' },
      { value: 'action:auth.logout', label: '로그아웃' },
      { value: 'action:auth.delete_account', label: '탈퇴' },
    ],
  },
  {
    label: '기록 (건강 기록장)',
    options: [
      { value: 'category:record', label: '▸ 기록 전체' },
      { value: 'action:record.create', label: '기록 추가' },
      { value: 'action:record.update', label: '기록 수정' },
      { value: 'action:record.delete', label: '기록 삭제' },
      { value: 'action:record.bulk_delete', label: '기록 일괄 삭제' },
    ],
  },
  {
    label: '반려동물',
    options: [
      { value: 'category:pet', label: '▸ 반려동물 전체' },
      { value: 'action:pet.create', label: '추가' },
      { value: 'action:pet.delete', label: '삭제' },
    ],
  },
  {
    label: '구독 / 결제',
    options: [
      { value: 'category:subscription', label: '▸ 구독 전체' },
      { value: 'action:subscription.purchase', label: '결제' },
      { value: 'action:subscription.cancel', label: '해지' },
      { value: 'action:subscription.refund', label: '환불' },
      { value: 'action:subscription.expired', label: '만료' },
      { value: 'action:subscription.auto_billed', label: '자동 갱신' },
      { value: 'action:subscription.auto_renew_disabled', label: '자동 갱신 해제' },
      { value: 'action:subscription.enable_recurring', label: '자동 결제 전환' },
    ],
  },
  {
    label: 'AI 분석',
    options: [
      { value: 'action:papers.analyze', label: 'AI 논문 분석' },
      { value: 'action:disease.describe', label: 'AI 질병 설명' },
      { value: 'action:analysis.save', label: '분석 보관' },
      { value: 'action:analysis.delete', label: '분석 삭제' },
      { value: 'action:paper.delete', label: '논문 삭제' },
    ],
  },
  {
    label: '푸시 알림',
    options: [
      { value: 'category:push', label: '▸ 푸시 전체' },
      { value: 'action:push.subscribe', label: '구독' },
      { value: 'action:push.unsubscribe', label: '해지' },
    ],
  },
  {
    label: '기타',
    options: [
      { value: 'action:profile.update', label: '프로필 수정' },
      { value: 'action:file.upload', label: '파일 업로드' },
      { value: 'action:file.delete', label: '파일 삭제' },
      { value: 'action:page.subscription', label: '구독 페이지 방문' },
    ],
  },
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
                className="px-3 py-2 border rounded-lg text-sm bg-white w-56"
              >
                {filterGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value || group.label} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
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
