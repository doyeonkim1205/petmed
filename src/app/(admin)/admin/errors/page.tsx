'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

interface Issue {
  id: string;
  title: string;
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}
interface Resp {
  configured: boolean;
  period?: string;
  error?: string;
  issues: Issue[];
}

type Period = '24h' | '14d' | '90d';
const PERIOD_LABEL: Record<Period, string> = { '24h': '24시간', '14d': '14일', '90d': '90일' };

function levelBadge(level: string): string {
  switch (level) {
    case 'fatal': return 'bg-red-200 text-red-800';
    case 'error': return 'bg-red-100 text-red-700';
    case 'warning': return 'bg-yellow-100 text-yellow-700';
    case 'info': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function timeAgo(iso: string): string {
  if (!iso) return '-';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function ErrorsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('24h');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/sentry?period=${period}`);
      setData(await res.json());
    } catch {
      setData({ configured: true, error: '조회 실패', issues: [] });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">에러 모니터링</h1>
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <AlertTriangle size={16} className={data?.issues.length ? 'text-red-500' : 'text-gray-400'} />
            미해결 에러 (최근 {PERIOD_LABEL[period]}, 빈도순 상위 25)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : data && data.configured === false ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 leading-relaxed">
              Sentry 읽기 토큰이 설정되지 않았습니다.<br />
              <code className="text-xs">SENTRY_API_TOKEN</code> (scope: project:read + event:read) 을
              환경변수에 추가하면 에러 목록이 표시됩니다.
            </div>
          ) : data?.error ? (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-4">{data.error}</div>
          ) : !data || data.issues.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">해당 기간에 미해결 에러가 없습니다. ✅</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>레벨</TableHead>
                  <TableHead>에러</TableHead>
                  <TableHead className="text-right">발생</TableHead>
                  <TableHead className="text-right">사용자</TableHead>
                  <TableHead>최근</TableHead>
                  <TableHead className="text-right">링크</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.issues.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${levelBadge(it.level)}`}>
                        {it.level}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
                      {it.culprit && <p className="text-[11px] text-gray-400 truncate">{it.culprit}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-right font-bold text-gray-700">{it.count.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right text-gray-500">{it.userCount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-gray-400">{timeAgo(it.lastSeen)}</TableCell>
                    <TableCell className="text-right">
                      {it.permalink && (
                        <a href={it.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex text-blue-500 hover:text-blue-700">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
