'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { TextField } from '@/components/TextField';

type SearchType = 'all' | 'disease' | 'symptom';
type LogKind = 'disease' | 'symptom' | 'symptom_refine';

interface MergedLog {
  id: string;
  user_id: string | null;
  query: string;
  pet_type: 'dog' | 'cat' | null;
  kind: LogKind;
  created_at: string;
  profile: { email: string; nickname: string | null } | null;
}

const kindConfig: Record<LogKind, { label: string; className: string }> = {
  disease: { label: '질병 검색', className: 'bg-blue-50 text-blue-600' },
  symptom: { label: '증상 분석', className: 'bg-orange-50 text-orange-600' },
  symptom_refine: { label: '증상 재분석', className: 'bg-rose-50 text-rose-600' },
};

const typeTabs: { id: SearchType; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'disease', label: '질병 검색' },
  { id: 'symptom', label: '증상 분석' },
];

function formatUser(p: MergedLog['profile']) {
  if (!p) return null;
  return p.nickname ? `${p.email} (${p.nickname})` : p.email;
}

export default function SearchLogsPage() {
  const [logs, setLogs] = useState<MergedLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [userId, setUserId] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const [loading, setLoading] = useState(true);
  const [datesReady, setDatesReady] = useState(false);

  useEffect(() => {
    async function initDates() {
      try {
        const res = await authFetch('/api/admin/activity-logs/date-range');
        const data = await res.json();
        if (data.from) setFrom(data.from);
      } catch {
        /* noop */
      }
      setDatesReady(true);
    }
    initDates();
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!datesReady) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), type });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (userId.trim()) params.set('userId', userId.trim());

    const res = await authFetch(`/api/admin/search-logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [page, from, to, userId, type, datesReady]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleTypeChange = (next: SearchType) => {
    setType(next);
    setPage(1);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">검색 로그</h1>
      <p className="text-sm text-gray-500 mb-6">
        질병 검색 (PubMed 논문) + 증상 분석 (AI) 통합 뷰
      </p>

      {/* 종류 탭 */}
      <div className="flex gap-2 mb-4">
        {typeTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTypeChange(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === t.id
                ? 'bg-gray-900 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
              <TextField placeholder="이메일 또는 UUID" value={userId} onChange={(e) => setUserId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-52" />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">검색</button>
            {(from || to || userId) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setUserId('');
                  setPage(1);
                }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
              >
                초기화
              </button>
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
                    <TableHead>종류</TableHead>
                    <TableHead>검색어</TableHead>
                    <TableHead>동물</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const actor = formatUser(log.profile);
                    const kind = kindConfig[log.kind];
                    return (
                      <TableRow key={`${log.kind}-${log.id}`}>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {actor ? (
                            actor
                          ) : log.user_id ? (
                            // 프로필은 없는데 user_id 는 있음 = 탈퇴한 유저
                            <span className="text-xs text-gray-400">
                              탈퇴 유저
                              <span className="ml-1 font-mono text-[10px]">({log.user_id.slice(0, 8)})</span>
                            </span>
                          ) : (
                            // user_id 자체가 null — 스키마상 불가하지만 방어
                            <span className="text-xs text-gray-400">비회원</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${kind.className}`}>
                            {kind.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[400px]">
                          <span className="block truncate" title={log.query}>
                            {log.query || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.pet_type ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                log.pet_type === 'dog' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              {log.pet_type === 'dog' ? '강아지' : '고양이'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        로그가 없습니다.
                      </TableCell>
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
