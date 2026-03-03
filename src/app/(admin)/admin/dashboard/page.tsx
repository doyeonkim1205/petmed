'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Search, CreditCard, UserCheck } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

interface DashboardStats {
  totalUsers: number;
  todaySearches: number;
  totalRevenue: number;
  activeSubscribers: number;
  todaySignups: number;
  planDistribution: { plan: string; count: number }[];
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
}
