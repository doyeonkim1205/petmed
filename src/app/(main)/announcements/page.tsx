'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Bell, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAnnouncements, markAnnouncementsSeen, getSeenAt, type Announcement } from '@/lib/announcements';

export default function AnnouncementsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevSeenAt, setPrevSeenAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    // 진입 시점의 "이전 본 시각"을 잡아 NEW 표시에 사용한 뒤, 읽음 처리.
    setPrevSeenAt(getSeenAt(user.id));
    (async () => {
      const data = await fetchAnnouncements();
      if (!alive) return;
      setItems(data);
      setLoading(false);
      markAnnouncementsSeen(user.id); // 들어오면 전체 읽음 → 헤더 뱃지 제거
    })();
    return () => { alive = false; };
  }, [user]);

  const isNew = (a: Announcement) => {
    const threshold = Math.max(
      user?.created_at ? new Date(user.created_at).getTime() : 0,
      prevSeenAt ? new Date(prevSeenAt).getTime() : 0,
    );
    return new Date(a.published_at).getTime() > threshold;
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-100 flex items-center px-2 h-12 z-10">
        <button onClick={() => router.back()} className="p-2 text-gray-500" aria-label={t('common.back')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <Bell size={15} className="text-blue-500" /> {t('announcements.title')}
        </h1>
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
          {items.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                {a.important && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded px-1.5 py-0.5">{t('announcements.important')}</span>
                )}
                <h2 className="text-sm font-bold text-gray-800 break-keep flex-1">{a.title}</h2>
                {isNew(a) && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line break-keep">{a.body}</p>
              <p className="text-[11px] text-gray-300 mt-2">{new Date(a.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
