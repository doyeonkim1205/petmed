'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PawIcon } from '@/components/icons/PawIcon';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAnnouncements, getSeenAt, countUnread } from '@/lib/announcements';

export function Header() {
  const t = useTranslations();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let alive = true;
    (async () => {
      const items = await fetchAnnouncements();
      if (alive) setUnread(countUnread(items, user.created_at, getSeenAt(user.id)));
    })();
    // 새소식 페이지에서 읽음 처리하면 즉시 뱃지 제거.
    const onSeen = () => { if (alive) setUnread(0); };
    window.addEventListener('announcementsSeen', onSeen);
    return () => { alive = false; window.removeEventListener('announcementsSeen', onSeen); };
  }, [user]);

  return (
    <header
      className="sticky top-0 bg-white border-b border-gray-200 z-50 flex items-center justify-center px-4"
      style={{ height: 'calc(3rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Link href="/" className="text-lg font-extrabold text-blue-600 flex items-center gap-1">
        <PawIcon size={18} className="text-blue-800 dark:text-blue-300" />
        PawDex
      </Link>
      {user && (
        <Link
          href="/announcements"
          aria-label={t('announcements.title')}
          className="absolute right-2 h-12 flex items-center px-1.5 text-gray-500 active:scale-95 transition-transform"
          style={{ top: 'env(safe-area-inset-top)' }}
        >
          <span className="relative">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white" />
            )}
          </span>
        </Link>
      )}
    </header>
  );
}
