'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

type Tab = '' | 'active' | 'canceled' | 'expired';

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    subscriptions: any[];
    subscriptionTotal: number;
    payments: any[];
    paymentTotal: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (tab) params.set('status', tab);
    const res = await authFetch(`/api/admin/subscriptions?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [page, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs: { value: Tab; label: string }[] = [
    { value: '', label: '전체' },
    { value: 'active', label: '활성' },
    { value: 'canceled', label: '취소' },
    { value: 'expired', label: '만료' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">구독/결제 관리</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Subscriptions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">구독 목록 ({data?.subscriptionTotal || 0}건)</CardTitle>
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
                    <TableHead>이메일</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>시작일</TableHead>
                    <TableHead>종료일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.subscriptions || []).map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-sm">{sub.profiles?.email}</TableCell>
                      <TableCell className="text-sm capitalize">{sub.plan}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          sub.status === 'active' ? 'bg-green-100 text-green-700' :
                          sub.status === 'canceled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {sub.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(sub.period_start).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(sub.period_end).toLocaleDateString('ko-KR')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.subscriptions || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">구독 데이터가 없습니다.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">페이지 {page} / {data?.totalPages || 1}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded border disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(data?.totalPages || 1, p + 1))} disabled={page >= (data?.totalPages || 1)} className="p-2 rounded border disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">결제 이력 ({data?.paymentTotal || 0}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>결제일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.payments || []).map((pay: any) => (
                <TableRow key={pay.id}>
                  <TableCell className="text-sm">{pay.profiles?.email}</TableCell>
                  <TableCell className="text-sm font-medium">₩{pay.amount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      pay.status === 'done' ? 'bg-green-100 text-green-700' :
                      pay.status === 'canceled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pay.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(pay.created_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.payments || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-8">결제 이력이 없습니다.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
