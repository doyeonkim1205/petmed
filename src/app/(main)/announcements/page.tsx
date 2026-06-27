'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAnnouncements, markAnnouncementsSeen, type Announcement } from '@/lib/announcements';

const RECENT_DAYS = 7; // 발행 7일 이내면 NEW 태그(읽음과 무관 — 최근성 기준)

export default function AnnouncementsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const data = await fetchAnnouncements();
      if (!alive) return;
      setItems(data);
      setLoading(false);
      markAnnouncementsSeen(user.id); // 들어오면 헤더 안읽음 뱃지 제거 (NEW 태그와는 별개)
    })();
    return () => { alive = false; };
  }, [user]);

  // NEW 태그 = 발행 7일 이내 (읽었어도 유지 → 나중에도 최근 글 식별).
  const isRecent = (a: Announcement) =>
    Date.now() - new Date(a.published_at).getTime() < RECENT_DAYS * 86400000;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 z-30 bg-white">
        <header className="relative flex items-center justify-center px-4 h-[60px]">
          <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500" aria-label={t('common.back')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">{t('announcements.title')}</h1>
        </header>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">{t('announcements.empty')}</p>
        </div>
      ) : (
        <div className="p-4 space-y-2.5">
          {items.map((a) => {
            const long = a.body.length > 60; // 길면 미리보기 2줄 + 더보기/접기
            const isExp = expanded.has(a.id);
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  {a.important && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded px-1.5 py-0.5">{t('announcements.important')}</span>
                  )}
                  {isRecent(a) && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 flex-shrink-0">NEW</span>
                  )}
                  <h2 className="text-sm font-bold text-gray-800 break-keep flex-1">{a.title}</h2>
                </div>
                <p className={`text-[13px] text-gray-600 leading-relaxed whitespace-pre-line break-keep ${long && !isExp ? 'line-clamp-2' : ''}`}>{a.body}</p>
                {long && (
                  <button onClick={() => toggle(a.id)} className="text-[12px] font-medium text-blue-500 mt-1">
                    {isExp ? t('announcements.less') : t('announcements.more')}
                  </button>
                )}
                <p className="text-[11px] text-gray-300 mt-2">{new Date(a.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
