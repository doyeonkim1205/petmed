'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Megaphone, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
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
      try {
        const data = await fetchAnnouncements(locale);
        if (!alive) return;
        setItems(data);
        setLoading(false);
        markAnnouncementsSeen(user.id); // 성공해서 화면에 띄운 경우에만 읽음 처리(헤더 뱃지 제거)
      } catch {
        if (alive) setLoading(false); // 네트워크 오류 → 읽음 처리 안 함(뱃지 유지, 다음에 재시도)
      }
    })();
    return () => { alive = false; };
  }, [user, locale]);

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
            const isExp = expanded.has(a.id);
            return (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {/* 제목만 보이고, 탭하면 본문 펼침(아코디언) */}
                <button onClick={() => toggle(a.id)} className="w-full flex items-center gap-1.5 p-4 text-left">
                  {a.important && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded px-1.5 py-0.5 flex-shrink-0">{t('announcements.important')}</span>
                  )}
                  {isRecent(a) && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 flex-shrink-0">NEW</span>
                  )}
                  <h2 className="text-sm font-bold text-gray-800 break-keep flex-1">{a.title}</h2>
                  {isExp ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </button>
                {isExp && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line break-keep">{a.body}</p>
                    {a.cta && (
                      <button
                        onClick={() => { const h = a.cta!.href; if (h.startsWith('/')) router.push(h); else window.open(h, '_blank', 'noopener'); }}
                        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 active:scale-95 transition-transform"
                      >
                        {a.cta.label}
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <p className="text-[11px] text-gray-300 mt-2">{new Date(a.published_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
