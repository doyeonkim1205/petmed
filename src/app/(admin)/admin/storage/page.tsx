'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HardDrive, Upload, AlertTriangle, Users } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

interface StorageUser {
  email: string;
  nickname: string;
  plan: string;
  fileCount: number;
  totalBytes: number;
  limitMB: number;
  usagePercent: number;
  lastUpload: string | null;
}

interface StorageData {
  summary: {
    totalStorageMB: number;
    totalFileCount: number;
    todayUploads: number;
    usersWithFiles: number;
    warningCount: number;
  };
  users: StorageUser[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/storage');
      setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>;

  const { summary, users } = data;

  const cards = [
    { title: '총 저장 용량', value: `${summary.totalStorageMB} MB`, icon: HardDrive, color: 'text-blue-600' },
    { title: '총 파일 수', value: summary.totalFileCount.toLocaleString(), icon: Upload, color: 'text-green-600' },
    { title: '오늘 업로드', value: summary.todayUploads.toLocaleString(), icon: Upload, color: 'text-purple-600' },
    { title: '용량 경고', value: `${summary.warningCount}명`, icon: AlertTriangle, color: summary.warningCount > 0 ? 'text-red-600' : 'text-gray-400' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">저장소 관리</h1>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Users size={16} />
            사용자별 저장소 사용량 ({users.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사용자</TableHead>
                <TableHead>플랜</TableHead>
                <TableHead>파일 수</TableHead>
                <TableHead>사용량</TableHead>
                <TableHead>한도</TableHead>
                <TableHead>사용률</TableHead>
                <TableHead>최근 업로드</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.email} className={user.usagePercent >= 80 ? 'bg-red-50' : ''}>
                  <TableCell className="text-sm">
                    <div>{user.nickname || '-'}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.plan === 'plus' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {user.plan}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{user.fileCount}</TableCell>
                  <TableCell className="text-sm">{formatBytes(user.totalBytes)}</TableCell>
                  <TableCell className="text-sm">{user.limitMB > 0 ? `${user.limitMB} MB` : '무제한'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            user.usagePercent >= 90 ? 'bg-red-500' :
                            user.usagePercent >= 80 ? 'bg-orange-500' :
                            user.usagePercent >= 50 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, user.usagePercent)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        user.usagePercent >= 80 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {user.usagePercent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {user.lastUpload ? new Date(user.lastUpload).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">파일을 업로드한 사용자가 없습니다.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
