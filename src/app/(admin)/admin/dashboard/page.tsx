'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, CreditCard, UserCheck, Database, AlertTriangle, Bookmark, Camera } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { TrendChart } from '@/components/admin/TrendChart';

interface HeavyUser {
  email: string;
  nickname: string;
  plan: string;
  records: number;
  pets: number;
  savedPapers: number;
}

interface DashboardStats {
  totalUsers: number;
  todaySearches: number;
  totalRevenue: number;
  activeSubscribers: number;
  todaySignups: number;
  planDistribution: { plan: string; count: number }[];
  heavyUsers: HeavyUser[];
  usageSummary: {
    totalRecords: number;
    totalPets: number;
    totalSavedPapers: number;
    totalSavedAnalyses: number;
    totalPhotoAnalyses: number;
  };
}

type TrendPoint = { bucket: string; signups: number; searches: number; revenue: number };
type Bucket = 'day' | 'week' | 'month';
type Metric = 'signups' | 'searches' | 'revenue';

const BUCKET_LABEL: Record<Bucket, string> = { day: '일', week: '주', month: '월' };
const METRIC_META: Record<Metric, { label: string; color: string; isMoney?: boolean }> = {
  signups: { label: '가입', color: '#3B82F6' },
  searches: { label: '검색', color: '#10B981' },
  revenue: { label: '매출', color: '#8B5CF6', isMoney: true },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 트래픽 추세
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [bucket, setBucket] = useState<Bucket>('day');
  const [metric, setMetric] = useState<Metric>('signups');
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/admin/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchTrends = useCallback(async () => {
    setTrendLoading(true);
    try {
      const res = await authFetch(`/api/admin/trends?bucket=${bucket}`);
      const json = await res.json();
      setTrends(json.trends || []);
    } catch {
      setTrends([]);
    } finally {
      setTrendLoading(false);
    }
  }, [bucket]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-500">통계를 불러올 수 없습니다.</p>;

  const cards = [
    { title: '총 회원', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-600' },
    { title: '오늘 검색', value: stats.todaySearches.toLocaleString(), icon: Search, color: 'text-green-600' },
    { title: '총 수익', value: `₩${stats.totalRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-purple-600' },
    { title: '활성 구독자', value: stats.activeSubscribers.toLocaleString(), icon: UserCheck, color: 'text-orange-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Icon size={16} className={card.color} />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">오늘 가입자</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.todaySignups}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">플랜별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.planDistribution.map((item) => (
                <div key={item.plan} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{item.plan}</span>
                  <span className="font-medium">{item.count}명</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 트래픽 추세 그래프 — 가입/검색/매출 시계열 (KST 버킷, gap-fill) */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-gray-500">트래픽 추세</CardTitle>
            <div className="flex items-center gap-3">
              {/* 지표 토글 */}
              <div className="flex gap-1">
                {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      metric === m ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    style={metric === m ? { backgroundColor: METRIC_META[m].color } : undefined}
                  >
                    {METRIC_META[m].label}
                  </button>
                ))}
              </div>
              {/* 버킷 토글 */}
              <div className="flex gap-1">
                {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBucket(b)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      bucket === b ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {BUCKET_LABEL[b]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : (
            <TrendChart
              data={trends.map((t) => ({ bucket: t.bucket, value: t[metric] }))}
              color={METRIC_META[metric].color}
              format={METRIC_META[metric].isMoney ? (n) => `₩${n.toLocaleString()}` : (n) => n.toLocaleString()}
            />
          )}
        </CardContent>
      </Card>

      {/* Data Usage Summary
          - 총 저장논문 = saved_papers (개별 PubMed 논문, 보관함의 자식)
          - 총 보관함   = saved_analyses (논문분석 + 사진분석 세션, 부모)
          - 사진분석     = saved_analyses 중 kind='symptom_photo'
          보관함/저장논문은 부모/자식이라 합산하지 않고 각각 표시. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: '총 건강기록', value: stats.usageSummary.totalRecords, icon: Database },
          { label: '총 반려동물', value: stats.usageSummary.totalPets, icon: Users },
          { label: '총 저장논문', value: stats.usageSummary.totalSavedPapers, icon: Search },
          { label: '총 보관함', value: stats.usageSummary.totalSavedAnalyses, icon: Bookmark },
          { label: '사진분석', value: stats.usageSummary.totalPhotoAnalyses, icon: Camera },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Icon size={14} />
                  {item.label}
                </div>
                <p className="text-xl font-bold">{item.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Heavy Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <AlertTriangle size={16} className={stats.heavyUsers.length > 0 ? 'text-orange-500' : 'text-gray-400'} />
            헤비유저 모니터링 ({stats.heavyUsers.length}명)
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">기록 50개 이상 · 반려동물 5마리 이상 · 논문저장 30개 이상</p>
        </CardHeader>
        <CardContent>
          {stats.heavyUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">해당하는 사용자가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead className="text-right">기록</TableHead>
                  <TableHead className="text-right">반려동물</TableHead>
                  <TableHead className="text-right">논문저장</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.heavyUsers.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell className="text-sm">
                      <div>{u.nickname || '-'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.plan === 'plus' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {u.plan}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">{u.records}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{u.pets}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{u.savedPapers}</TableCell>
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
