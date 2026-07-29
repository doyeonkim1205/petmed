import { supabase } from './supabase';

export interface AnnouncementCta {
  label: string; // locale 반영된 버튼 라벨
  href: string;  // 내부 경로(예: /records/labs) 또는 외부 URL
}

export interface Announcement {
  id: string;
  title: string;   // locale 반영된 값
  body: string;    // locale 반영된 값
  important: boolean;
  published_at: string;
  cta: AnnouncementCta | null;
}

// DB 원본 행(로케일 컬럼 포함) — 내부용.
interface AnnouncementRow {
  id: string;
  title: string;
  title_en: string | null;
  body: string;
  body_en: string | null;
  important: boolean;
  published_at: string;
  cta_label: string | null;
  cta_label_en: string | null;
  cta_href: string | null;
}

/**
 * 활성 공지 — 최신순, locale 반영. 실패 시 throw (호출부가 "성공일 때만 읽음 처리" 하도록).
 * 영어 유저는 번역(title_en+body_en) 있는 공지만 노출 → 한글 노출 0.
 *   (KR 전용 공지는 영어 유저 목록·안읽음 카운트 양쪽에서 제외 — fetch 단계에서 걸러 일관성 유지.)
 */
export async function fetchAnnouncements(locale: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, title_en, body, body_en, important, published_at, cta_label, cta_label_en, cta_href')
    .eq('is_active', true)
    .order('published_at', { ascending: false });
  if (error) throw error;
  const isEn = locale === 'en';
  const out: Announcement[] = [];
  for (const r of (data as AnnouncementRow[]) || []) {
    if (isEn && (!r.title_en || !r.body_en)) continue; // 영어 번역 없으면 영어 유저에겐 숨김
    const label = isEn ? r.cta_label_en : r.cta_label;
    out.push({
      id: r.id,
      title: isEn ? r.title_en! : r.title,
      body: isEn ? r.body_en! : r.body,
      important: r.important,
      published_at: r.published_at,
      cta: r.cta_href && label ? { label, href: r.cta_href } : null,
    });
  }
  return out;
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
