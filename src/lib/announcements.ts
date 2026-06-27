import { supabase } from './supabase';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  important: boolean;
  published_at: string;
}

/** 활성 공지 — 최신순. 실패 시 throw (호출부가 "성공일 때만 읽음 처리" 하도록). */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, important, published_at')
    .eq('is_active', true)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data as Announcement[]) || [];
}

const seenKey = (uid: string) => `announcementsSeenAt_${uid}`;

export function getSeenAt(uid: string): string | null {
  try { return localStorage.getItem(seenKey(uid)); } catch { return null; }
}

/** 새소식 페이지 진입 시 호출 — "지금"을 마지막 본 시각으로 저장 → 뱃지 사라짐. */
export function markAnnouncementsSeen(uid: string): void {
  try {
    localStorage.setItem(seenKey(uid), new Date().toISOString());
    window.dispatchEvent(new Event('announcementsSeen'));
  } catch {}
}

/**
 * 안 읽은 개수. 기준 = max(가입일, 마지막 본 시각) 이후 발행분.
 * 가입일 이전 공지는 제외 → 신규 가입자에게 과거 공지 백로그가 쌓이지 않음.
 */
export function countUnread(items: Announcement[], signupAt: string | null | undefined, seenAt: string | null): number {
  const threshold = Math.max(
    signupAt ? new Date(signupAt).getTime() : 0,
    seenAt ? new Date(seenAt).getTime() : 0,
  );
  return items.filter((a) => new Date(a.published_at).getTime() > threshold).length;
}
