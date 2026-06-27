-- 새소식(공지) 테이블 — 헤더 종 → 새소식 페이지에서 노출.
--
-- 재배포 없이 글만 insert 하면 공지 노출. 안 읽음 판정은 클라(localStorage seenAt) +
-- 가입일 게이팅(가입 이전 공지는 그 유저에게 안 보임 → 신규 가입자 백로그 누적 방지).
-- 쓰기는 service role(관리자/SQL)만, 읽기는 로그인 유저(활성 공지).
--
-- ⚠️ 2026-06-28 현재 DEV(lzmmiksdvioidcldrnvh)에만 적용. 운영 배포 시 PROD 에도 동일 적용 필요.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  important boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists announcements_select_auth on public.announcements;
create policy announcements_select_auth on public.announcements
  for select to authenticated using (is_active = true);
