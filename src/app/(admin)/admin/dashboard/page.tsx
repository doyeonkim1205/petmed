'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, CreditCard, UserCheck, Database, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

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
  usageSummary: { totalRecords: number; totalPets: number; totalSavedPapers: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/admin/stats')
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

      {/* Data Usage Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '총 건강기록', value: stats.usageSummary.totalRecords, icon: Database },
          { label: '총 반려동물', value: stats.usageSummary.totalPets, icon: Users },
          { label: '총 저장논문', value: stats.usageSummary.totalSavedPapers, icon: Search },
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
