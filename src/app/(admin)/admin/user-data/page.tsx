'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShieldCheck } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { TextField } from '@/components/TextField';

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  plan: string;
  role: string;
  created_at: string;
  provider?: string;
  platform?: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일', google: '구글', kakao: '카카오', apple: '애플',
};
const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: '웹' };

/**
 * 회원 데이터 조회 — 열람 전용 진입점.
 * 이메일/닉네임으로 유저를 찾아 상세 페이지(/admin/user-data/[id])로 이동한다.
 * 운영(플랜변경·환불·삭제)은 '사용자 관리' 메뉴에서만. 여기선 오직 열람.
 */
export default function UserDataSearchPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', search: search.trim() });
    const res = await authFetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setLoading(false);
    setSearched(true);
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">회원 데이터 조회</h1>
      </div>
      <div className="flex items-center gap-1.5 mb-6 text-sm text-gray-500">
        <ShieldCheck size={15} className="text-green-600" />
        열람 전용 · 모든 조회 기록은 활동 로그에 남습니다.
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <TextField
                placeholder="가입 이메일 또는 닉네임으로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                enterKeyHint="search"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">
              검색
            </button>
          </form>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">검색 결과 {total}명</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
              </div>
            ) : users.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">일치하는 회원이 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>닉네임</TableHead>
                    <TableHead>가입</TableHead>
                    <TableHead>플랫폼</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/user-data/${user.id}`)}
                    >
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm">{user.nickname || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {PROVIDER_LABEL[user.provider || 'email'] || user.provider || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.platform ? (PLATFORM_LABEL[user.platform] || user.platform) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          user.plan === 'plus' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.plan}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
