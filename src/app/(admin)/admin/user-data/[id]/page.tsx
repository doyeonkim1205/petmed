'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, PawPrint, FileText, Pill, FlaskConical, Search as SearchIcon, Bookmark, ChevronDown, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

/* ── 타입 (API 응답 셰이프) ── */
interface Overview {
  profile: { id: string; email: string; nickname: string; avatar_url?: string; plan: string; role: string; created_at: string };
  subscription: { plan: string; status: string; period_end: string; canceled_at?: string | null; billing_type?: string; product_id?: string; next_billing_at?: string } | null;
  payments: { id: string; amount: number; status: string; created_at: string; store?: string | null; environment?: string | null }[];
  counts: { records: number; pets: number; meds: number; labs: number; searches: number; savedAnalyses: number };
}
interface Pet {
  id: string; name: string; type: 'dog' | 'cat'; breed?: string; birth_date?: string;
  sex?: 'male' | 'female' | null; neutered?: boolean | null; weight?: number | null;
  chronic_conditions?: string[] | null; created_at: string;
}
interface RecordRow {
  id: string; pet_id: string; record_type: string; title: string; description?: string;
  hospital_name?: string; visit_date: string; cost?: number; discharge_date?: string;
  next_appointment_date?: string; symptom_time?: string; weight?: number;
  sub_entries?: { sub_kind: string; time?: string; memo?: string }[] | null;
  created_at: string;
  pets?: { id: string; name: string; type: string };
  medications?: { id: string; name: string; dosage?: string; frequency?: string }[];
  record_files?: { id: string }[];
}

type TabKey = 'overview' | 'pets' | 'records';

const RECORD_TYPE_LABEL: Record<string, string> = {
  symptom: '증상', visit: '진료', hospitalization: '입퇴원', manual: '기타', daily: '일상',
};
const SUB_KIND_LABEL: Record<string, string> = {
  meal: '식사', hydration: '수분', walk: '산책', poop: '배변', mood: '기분', other: '기타',
};
const STORE_LABEL: Record<string, string> = { toss: '토스', play: '구글', apple: '애플' };

function fmtDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR');
}

export default function UserDataDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [tab, setTab] = useState<TabKey>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pets, setPets] = useState<Pet[] | null>(null);
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 개요 로드 (진입 시)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await authFetch(`/api/admin/users/${id}/data?section=overview`);
      const data = await res.json();
      setOverview(data);
      setLoading(false);
    })();
  }, [id]);

  const loadPets = useCallback(async () => {
    const res = await authFetch(`/api/admin/users/${id}/data?section=pets`);
    const data = await res.json();
    setPets(data.pets || []);
  }, [id]);

  const loadRecords = useCallback(async (page: number) => {
    const res = await authFetch(`/api/admin/users/${id}/data?section=records&page=${page}`);
    const data = await res.json();
    setRecords(data.records || []);
    setRecordsPage(data.page || 1);
    setRecordsTotalPages(data.totalPages || 1);
  }, [id]);

  // 탭 진입 시 지연 로드 (한 번만)
  useEffect(() => {
    if (tab === 'pets' && pets === null) loadPets();
    if (tab === 'records' && records === null) loadRecords(1);
  }, [tab, pets, records, loadPets, loadRecords]);

  const toggle = (rid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid); else next.add(rid);
      return next;
    });

  const TABS: { key: TabKey; label: string; icon: typeof PawPrint }[] = [
    { key: 'overview', label: '개요', icon: FileText },
    { key: 'pets', label: '반려동물', icon: PawPrint },
    { key: 'records', label: '건강기록', icon: FileText },
  ];

  if (loading || !overview) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
      </div>
    );
  }

  const p = overview.profile;

  return (
    <div>
      {/* 헤더 */}
      <button
        onClick={() => router.push('/admin/user-data')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft size={16} /> 검색으로
      </button>

      <div className="flex items-center gap-3 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
            {(p.nickname || p.email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{p.nickname || '(닉네임 없음)'}</h1>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              p.plan === 'plus' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}>{p.plan}</span>
            {p.role === 'admin' && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">admin</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{p.email} · 가입 {fmtDate(p.created_at)}</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                active ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── 개요 ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <CountCard icon={FileText} label="건강기록" value={overview.counts.records} onClick={() => setTab('records')} />
            <CountCard icon={PawPrint} label="반려동물" value={overview.counts.pets} onClick={() => setTab('pets')} />
            <CountCard icon={Pill} label="복약" value={overview.counts.meds} />
            <CountCard icon={FlaskConical} label="검사" value={overview.counts.labs} />
            <CountCard icon={SearchIcon} label="검색" value={overview.counts.searches} />
            <CountCard icon={Bookmark} label="보관함" value={overview.counts.savedAnalyses} />
          </div>

          {overview.subscription && (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">구독 정보</p>
                <div className="grid grid-cols-2 gap-y-2 text-sm max-w-md">
                  <span className="text-gray-500">상태</span>
                  <span className="font-medium">{overview.subscription.status}</span>
                  <span className="text-gray-500">결제 방식</span>
                  <span className="font-medium">{overview.subscription.billing_type === 'recurring' ? '자동 갱신' : '1회 결제'}</span>
                  <span className="text-gray-500">만료일</span>
                  <span className="font-medium">{fmtDate(overview.subscription.period_end)}</span>
                  {overview.subscription.next_billing_at && (
                    <>
                      <span className="text-gray-500">다음 결제</span>
                      <span className="font-medium text-blue-600">{fmtDate(overview.subscription.next_billing_at)}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {overview.payments.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">결제 내역</p>
                <div className="space-y-1.5">
                  {overview.payments.map((pay) => (
                    <div key={pay.id} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{fmtDate(pay.created_at)}</span>
                      <span className="font-medium">{pay.amount.toLocaleString()}원</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        pay.status === 'done' ? 'bg-green-100 text-green-700' :
                        pay.status === 'refunded' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                      }`}>{pay.status === 'done' ? '완료' : pay.status === 'refunded' ? '환불됨' : pay.status}</span>
                      {pay.store && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{STORE_LABEL[pay.store] || pay.store}</span>}
                      {pay.environment === 'sandbox' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">테스트</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── 반려동물 ── */}
      {tab === 'pets' && (
        pets === null ? <TabLoading /> :
        pets.length === 0 ? <Empty text="등록된 반려동물이 없습니다." /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {pets.map((pet) => (
              <Card key={pet.id}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{pet.type === 'cat' ? '🐱' : '🐶'}</span>
                    <span className="font-bold">{pet.name}</span>
                    <span className="text-xs text-gray-400">{pet.type === 'cat' ? '고양이' : '강아지'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <Field label="품종" value={pet.breed || '-'} />
                    <Field label="생일" value={fmtDate(pet.birth_date)} />
                    <Field label="성별" value={pet.sex === 'male' ? '수컷' : pet.sex === 'female' ? '암컷' : '-'} />
                    <Field label="중성화" value={pet.neutered == null ? '-' : pet.neutered ? '완료' : '안 함'} />
                    <Field label="체중" value={pet.weight != null ? `${pet.weight}kg` : '-'} />
                    <Field label="등록일" value={fmtDate(pet.created_at)} />
                  </div>
                  {pet.chronic_conditions && pet.chronic_conditions.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-400">만성질환</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pet.chronic_conditions.map((c, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── 건강기록 ── */}
      {tab === 'records' && (
        records === null ? <TabLoading /> :
        records.length === 0 ? <Empty text="건강 기록이 없습니다." /> : (
          <div className="space-y-2">
            {records.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <Card key={r.id}>
                  <button onClick={() => toggle(r.id)} className="w-full text-left">
                    <CardContent className="py-3 flex items-center gap-3">
                      {isOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{RECORD_TYPE_LABEL[r.record_type] || r.record_type}</span>
                      <span className="font-medium text-sm truncate">{r.title}</span>
                      <span className="ml-auto text-xs text-gray-400 shrink-0">{r.pets?.name || '-'} · {fmtDate(r.visit_date)}</span>
                    </CardContent>
                  </button>
                  {isOpen && (
                    <CardContent className="pt-0 pb-4 pl-9 space-y-2 text-sm">
                      {r.description && <p className="text-gray-700 whitespace-pre-wrap">{r.description}</p>}
                      <div className="grid grid-cols-2 gap-y-1 max-w-md text-[13px]">
                        {r.hospital_name && <Field label="병원" value={r.hospital_name} />}
                        {r.cost != null && <Field label="비용" value={`${r.cost.toLocaleString()}원`} />}
                        {r.weight != null && <Field label="체중" value={`${r.weight}kg`} />}
                        {r.symptom_time && <Field label="증상 시각" value={r.symptom_time} />}
                        {r.discharge_date && <Field label="퇴원일" value={fmtDate(r.discharge_date)} />}
                        {r.next_appointment_date && <Field label="다음 예약" value={fmtDate(r.next_appointment_date)} />}
                      </div>
                      {r.medications && r.medications.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400">투약</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.medications.map((m) => (
                              <span key={m.id} className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                {m.name}{m.dosage ? ` ${m.dosage}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.sub_entries && r.sub_entries.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400">일상</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.sub_entries.map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                                {SUB_KIND_LABEL[s.sub_kind] || s.sub_kind}{s.time ? ` ${s.time}` : ''}{s.memo ? ` · ${s.memo}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.record_files && r.record_files.length > 0 && (
                        <p className="text-xs text-gray-400">첨부 {r.record_files.length}개</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {recordsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <button
                  disabled={recordsPage <= 1}
                  onClick={() => loadRecords(recordsPage - 1)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >이전</button>
                <span className="text-sm text-gray-500">{recordsPage} / {recordsTotalPages}</span>
                <button
                  disabled={recordsPage >= recordsTotalPages}
                  onClick={() => loadRecords(recordsPage + 1)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >다음</button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

/* ── 공용 소품 ── */
function CountCard({ icon: Icon, label, value, onClick }: { icon: typeof PawPrint; label: string; value: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border border-gray-100 bg-white p-3 text-center ${onClick ? 'hover:border-gray-300 cursor-pointer' : 'cursor-default'}`}
    >
      <Icon size={16} className="mx-auto text-gray-400 mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </button>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </>
  );
}
function TabLoading() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-gray-400">{text}</p>;
}
