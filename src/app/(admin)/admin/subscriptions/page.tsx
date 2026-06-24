'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Loader2, Download } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { downloadCsv } from '@/lib/adminExport';
import { Pagination } from '@/components/admin/Pagination';

type Tab = '' | 'active' | 'canceled' | 'expired';

function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    purchase: '결제',
    renew: '갱신',
    cancel: '해지',
    refund: '환불',
    expired: '만료',
    downgrade: '다운그레이드',
    upgrade: '업그레이드',
  };
  return labels[type] || type;
}

function eventTypeBadge(type: string): string {
  const badges: Record<string, string> = {
    purchase: 'bg-green-100 text-green-700',
    renew: 'bg-blue-100 text-blue-700',
    cancel: 'bg-orange-100 text-orange-700',
    refund: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    downgrade: 'bg-yellow-100 text-yellow-700',
    upgrade: 'bg-purple-100 text-purple-700',
  };
  return badges[type] || 'bg-gray-100 text-gray-600';
}

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('');
  // 세 테이블 독립 페이지네이션 — 구독/결제/이벤트 각자 페이지.
  const [subPage, setSubPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [data, setData] = useState<{
    subscriptions: any[];
    subscriptionTotal: number;
    subscriptionPages: number;
    payments: any[];
    paymentTotal: number;
    paymentPages: number;
    events: any[];
    eventTotal: number;
    eventPages: number;
    eventStats: Record<string, number>;
    failedBillings: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      subPage: String(subPage),
      payPage: String(payPage),
      eventPage: String(eventPage),
    });
    if (tab) params.set('status', tab);
    const res = await authFetch(`/api/admin/subscriptions?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [subPage, payPage, eventPage, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 결제이력에서 직접 환불 — 기존 admin 환불 라우트 호출 (토스 취소 + plan free + 구독 만료 자동).
  //   실제 카드 환불이 발생하므로 confirm 필수. status='done' 만 환불 가능.
  const handleRefund = async (pay: { id: string; user_id: string; amount: number }) => {
    if (!confirm(`${pay.amount?.toLocaleString()}원을 환불하시겠습니까?\n토스 결제 취소 + 무료 플랜 전환이 즉시 진행됩니다.`)) return;
    setRefundingId(pay.id);
    try {
      const res = await authFetch(`/api/admin/users/${pay.user_id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: pay.id }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '환불에 실패했습니다.'); return; }
      alert(json.message || '환불 완료');
      await fetchData();
    } catch {
      alert('환불 처리 중 오류가 발생했습니다.');
    } finally {
      setRefundingId(null);
    }
  };

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
            onClick={() => { setTab(t.value); setSubPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 결제 실패 큐 — billing_failed_count >= 1 (자동 결제 실패/재시도) */}
      {(data?.failedBillings?.length ?? 0) > 0 && (
        <Card className="mb-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              결제 실패 큐 ({data?.failedBillings.length}건)
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">자동 결제가 실패한 구독. cron 이 재시도하며, 최종 실패 시 만료 처리됩니다.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">실패 횟수</TableHead>
                  <TableHead>카드사</TableHead>
                  <TableHead>다음 결제일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.failedBillings || []).map((f: any) => (
                  <TableRow key={f.user_id}>
                    <TableCell className="text-sm">{f.profiles?.email || '-'}</TableCell>
                    <TableCell className="text-sm capitalize">{f.plan}</TableCell>
                    <TableCell className="text-sm">{f.status}</TableCell>
                    <TableCell className="text-sm text-right font-bold text-red-600">{f.billing_failed_count}</TableCell>
                    <TableCell className="text-sm text-gray-500">{f.card_company || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {f.next_billing_at ? new Date(f.next_billing_at).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">구독 목록 ({data?.subscriptionTotal || 0}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : (
            <>
              {data?.platformCounts && (
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <span className="text-gray-400">활성 구독자</span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">iOS {data.platformCounts.ios}</span>
                  <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">Android {data.platformCounts.android}</span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">웹 {data.platformCounts.web}</span>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>플랫폼</TableHead>
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
                      <TableCell className="text-sm">
                        {sub.store === 'apple' ? 'iOS'
                          : (sub.store === 'play' || sub.store === 'play_store') ? 'Android'
                          : sub.store === 'toss' ? '웹'
                          : (sub.store || '-')}
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

              <Pagination page={subPage} totalPages={data?.subscriptionPages || 1} onChange={setSubPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-500">결제 이력 ({data?.paymentTotal || 0}건)</CardTitle>
            <button
              onClick={() => downloadCsv('/api/admin/export?type=payments', 'payments.csv')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>결제일</TableHead>
                <TableHead className="text-right">환불</TableHead>
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
                      pay.status === 'refunded' ? 'bg-gray-200 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pay.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(pay.created_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {pay.status === 'done' ? (
                      <button
                        onClick={() => handleRefund(pay)}
                        disabled={refundingId === pay.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-40"
                      >
                        {refundingId === pay.id ? <Loader2 size={12} className="animate-spin" /> : null}
                        환불
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.payments || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">결제 이력이 없습니다.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Pagination page={payPage} totalPages={data?.paymentPages || 1} onChange={setPayPage} />
        </CardContent>
      </Card>

      {/* Event Stats */}
      {data?.eventStats && Object.keys(data.eventStats).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(data.eventStats).map(([type, count]) => (
            <Card key={type}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{eventTypeLabel(type)}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Subscription Events Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">구독 이벤트 로그 ({data?.eventTotal || 0}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>이벤트</TableHead>
                <TableHead>플랜</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>사유</TableHead>
                <TableHead>일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.events || []).map((evt: any) => (
                <TableRow key={evt.id}>
                  <TableCell className="text-sm">{evt.profiles?.email || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${eventTypeBadge(evt.event_type)}`}>
                      {eventTypeLabel(evt.event_type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{evt.plan}</TableCell>
                  <TableCell className="text-sm">{evt.amount ? `₩${evt.amount.toLocaleString()}` : '-'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{evt.reason || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(evt.created_at).toLocaleString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))}
              {(data?.events || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">이벤트 기록이 없습니다.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Pagination page={eventPage} totalPages={data?.eventPages || 1} onChange={setEventPage} />
        </CardContent>
      </Card>
    </div>
  );
}
