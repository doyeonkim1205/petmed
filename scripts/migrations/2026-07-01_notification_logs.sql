-- 2026-07-01  notification_logs
--
-- 서버발 1회성 알림(예: 3일 전 구독 만료/결제 리마인더)의 멱등성 로그.
-- 기존 subscriptions.reminder_3day_sent_at 단일 컬럼 + 4곳 리셋 패턴을 대체한다.
-- dedup 은 (user_id, type, dedup_key) 유니크. 3일 리마인더는
--   type='sub_expiry_3day', dedup_key=period_end 날짜(YYYY-MM-DD)
-- → 주기가 넘어가면 period_end 가 이동해 키가 바뀌므로 별도 리셋 없이 다음 주기에 다시 발송된다.
--
-- 발송 로직(src/app/api/cron/push-notifications/route.ts)은 발송 전에 여기 insert(예약/claim)해
-- 유니크 제약으로 동시 실행 이중발송을 원천 차단한다(23505 = 이미 예약 → 발송 스킵).
--
-- 적용: dev(lzmmiksdvioidcldrnvh) + prod(ylbxtzwbwbnlmfxqgmoz) 에 Management API 로 적용 완료.
-- 멱등(IF NOT EXISTS)이라 재실행 안전.

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  dedup_key text not null,
  sent_at timestamptz not null default now(),
  meta jsonb,
  constraint notification_logs_unique unique (user_id, type, dedup_key)
);

create index if not exists notification_logs_user_type_idx on public.notification_logs (user_id, type);
create index if not exists notification_logs_sent_at_idx on public.notification_logs (sent_at);

alter table public.notification_logs enable row level security;
-- RLS: 클라이언트 접근 없음(서버 service_role 만 사용) → 정책 미부여 = 클라 전부 차단.

comment on table public.notification_logs is
  'Idempotency log for one-shot server notifications (e.g. sub_expiry_3day). dedup via (user_id, type, dedup_key).';

-- ── 후속 정리(TODO) ──────────────────────────────────────────────
-- subscriptions.reminder_3day_sent_at 는 현재 코드 참조 0(dead)이나,
-- scripts/*reminder*.mjs · scripts/test-billing-cron.mjs 가 아직 참조한다.
-- 그 스크립트 정리 후 아래를 별도 마이그레이션으로 실행:
--   alter table public.subscriptions drop column if exists reminder_3day_sent_at;
