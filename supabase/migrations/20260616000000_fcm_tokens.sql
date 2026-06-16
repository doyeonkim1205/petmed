-- FCM(네이티브 앱) 푸시 토큰 저장 테이블.
-- 기존 web-push(push_subscriptions)와 분리 — 발송 경로에서 둘 다 대상으로 보낸다.
-- token 글로벌 유니크: 같은 기기에 다른 계정이 로그인하면 user_id 가 이전(소유권 이전)
-- → 이전 계정 알림이 새 계정 기기로 배달되는 문제 방지 (web-push 와 동일 정책).

create table if not exists public.fcm_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fcm_tokens_user_id_idx on public.fcm_tokens(user_id);

-- 서버(service_role)만 접근. 클라이언트 직접 접근 차단 (정책 없음 = 거부).
alter table public.fcm_tokens enable row level security;
