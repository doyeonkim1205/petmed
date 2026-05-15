'use client';

import { useEffect, useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { TextField } from '@/components/TextField';

interface User {
  id: string;
  email: string;
  nickname: string;
  plan: string;
  role: string;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface UserDetail {
  profile: User & { avatar_url?: string };
  subscription: {
    plan: string;
    status: string;
    period_end: string;
    billing_type?: string;
    product_id?: string;
    next_billing_at?: string;
    card_company?: string;
    card_number?: string;
    billing_failed_count?: number;
  } | null;
  searchCount: number;
  payments: Payment[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    if (planFilter) params.set('plan', planFilter);

    const res = await authFetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, search, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openDetail = async (id: string) => {
    const res = await authFetch(`/api/admin/users/${id}`);
    const data = await res.json();
    setSelectedUser(data);
    setModalOpen(true);
  };

  const updateUser = async (field: string, value: string) => {
    if (!selectedUser) return;
    setSaving(true);
    await authFetch(`/api/admin/users/${selectedUser.profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    setModalOpen(false);
    fetchUsers();
  };

  const refundPayment = async (paymentId: string) => {
    if (!selectedUser || !confirm('이 결제를 환불하시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/admin/users/${selectedUser.profile.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
      openDetail(selectedUser.profile.id);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'admin', action: 'user-refund' },
        extra: { targetUserId: selectedUser?.profile.id },
      });
      alert(err instanceof Error ? err.message : '환불 실패');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    setDeleteMessage('');
    try {
      const res = await authFetch(`/api/admin/users/${selectedUser.profile.id}/delete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteMessage(data.message);
      setShowDeleteConfirm(false);
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'admin', action: 'user-delete' },
        extra: { targetUserId: selectedUser?.profile.id },
      });
      setDeleteMessage(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">사용자 관리</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <TextField
                placeholder="이메일 또는 닉네임 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                enterKeyHint="search"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">전체 플랜</option>
              <option value="free">Free</option>
              <option value="plus">Plus</option>
            </select>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">
              검색
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-500">총 {total}명</CardTitle>
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
                    <TableHead>닉네임</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(user.id)}
                    >
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm">{user.nickname || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          user.plan === 'plus' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.plan}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">페이지 {page} / {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded border disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded border disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">사용자 상세</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-sm text-gray-500">이메일</span>
                <p className="font-medium">{selectedUser.profile.email}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">닉네임</span>
                <p className="font-medium">{selectedUser.profile.nickname || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">총 검색 횟수</span>
                <p className="font-medium">{selectedUser.searchCount}회</p>
              </div>
              {selectedUser.subscription && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <span className="text-sm font-semibold text-gray-700">구독 정보</span>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-500">상태</span>
                    <span className={`font-medium ${
                      selectedUser.subscription.status === 'active' ? 'text-green-600' :
                      selectedUser.subscription.status === 'canceled' ? 'text-orange-500' : 'text-red-500'
                    }`}>
                      {selectedUser.subscription.status === 'active' ? '이용 중' :
                       selectedUser.subscription.status === 'canceled' ? '해지됨' : '만료됨'}
                    </span>

                    <span className="text-gray-500">결제 방식</span>
                    <span className="font-medium">
                      {selectedUser.subscription.billing_type === 'recurring' ? '자동 갱신' : '1회 결제'}
                    </span>

                    <span className="text-gray-500">결제 주기</span>
                    <span className="font-medium">
                      {selectedUser.subscription.product_id?.includes('yearly') ? '연간' :
                       selectedUser.subscription.product_id?.includes('monthly') ? '월간' : '-'}
                    </span>

                    <span className="text-gray-500">만료일</span>
                    <span className="font-medium">
                      {new Date(selectedUser.subscription.period_end).toLocaleDateString('ko-KR')}
                    </span>

                    {selectedUser.subscription.next_billing_at && (
                      <>
                        <span className="text-gray-500">다음 결제</span>
                        <span className="font-medium text-blue-600">
                          {new Date(selectedUser.subscription.next_billing_at).toLocaleDateString('ko-KR')}
                        </span>
                      </>
                    )}

                    {selectedUser.subscription.card_number && (
                      <>
                        <span className="text-gray-500">결제 카드</span>
                        <span className="font-medium">
                          {selectedUser.subscription.card_company || ''} {selectedUser.subscription.card_number}
                        </span>
                      </>
                    )}

                    {(selectedUser.subscription.billing_failed_count ?? 0) > 0 && (
                      <>
                        <span className="text-gray-500">결제 실패</span>
                        <span className="font-medium text-red-500">
                          {selectedUser.subscription.billing_failed_count}회
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {!selectedUser.subscription && selectedUser.profile.plan !== 'free' && (
                <div className="bg-yellow-50 rounded-lg p-3">
                  <span className="text-sm text-yellow-700">Plus 플랜이지만 구독 데이터 없음 (관리자 수동 부여)</span>
                </div>
              )}
            </div>

            {/* Payment history */}
            {selectedUser.payments.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-6">
                <span className="text-sm font-semibold text-gray-700">결제 내역</span>
                {selectedUser.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-500">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                      <span className="ml-2 font-medium">{p.amount.toLocaleString()}원</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        p.status === 'done' ? 'bg-green-100 text-green-700' :
                        p.status === 'refunded' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                      }`}>{p.status === 'done' ? '완료' : p.status === 'refunded' ? '환불됨' : p.status}</span>
                    </div>
                    {p.status === 'done' && (
                      <button onClick={() => refundPayment(p.id)} disabled={saving}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">환불</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 block mb-1">플랜 변경</label>
                <select
                  defaultValue={selectedUser.profile.plan}
                  onChange={(e) => updateUser('plan', e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="free">Free</option>
                  <option value="plus">Plus</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">역할 변경</label>
                <select
                  defaultValue={selectedUser.profile.role}
                  onChange={(e) => updateUser('role', e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Delete user */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              {deleteMessage && (
                <p className="text-sm text-red-500 mb-2">{deleteMessage}</p>
              )}
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  계정 삭제
                </button>
              ) : (
                <div className="bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-red-700">정말 삭제하시겠습니까?</p>
                  <p className="text-xs text-red-500">이 사용자의 모든 데이터가 영구 삭제됩니다. 복구할 수 없습니다.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                    <button onClick={deleteUser} disabled={deleting}
                      className="flex-1 py-2 text-xs bg-red-500 text-white rounded-lg disabled:opacity-50">
                      {deleting ? '삭제 중...' : '영구 삭제'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
