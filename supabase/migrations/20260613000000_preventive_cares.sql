-- 예방 관리(Preventive Care) — 백신 + 정기 예방약(심장사상충·외부기생충·내부구충)을 한 곳에서.
--
-- 복약(medications)과 분리한 이유: 복약은 "1일 N회" 일일 모델, 예방은 "월/연 주기" 모델이라
-- 스케줄 계산·알림 방식이 달라 별도 테이블이 깔끔.
--
-- category: heartworm(심장사상충) | external_parasite(외부기생충) | internal_worm(내부구충)
--           | vaccine(종합백신) | rabies(광견병) | other(기타)
-- interval_unit/value: 주기. month+1=월1회, month+3=3개월, year+1=연1회.
-- next_due_date: last_done_date + interval 로 계산해 저장 (정렬·알림 쿼리 단순화).
-- alarm_enabled: 예정일 D-3·당일 푸시 여부 (Plus 전용 — 발송 게이팅은 cron 에서).

create table if not exists public.preventive_cares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid not null,
  category text not null default 'other',
  name text not null default '',
  last_done_date date not null default current_date,
  interval_unit text not null default 'month',
  interval_value int not null default 1,
  next_due_date date not null,
  alarm_enabled boolean not null default true,
  memo text,
  created_at timestamptz default now()
);

alter table public.preventive_cares enable row level security;

create policy preventive_cares_select_own on public.preventive_cares
  for select using (auth.uid() = user_id);
create policy preventive_cares_insert_own on public.preventive_cares
  for insert with check (auth.uid() = user_id);
create policy preventive_cares_update_own on public.preventive_cares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy preventive_cares_delete_own on public.preventive_cares
  for delete using (auth.uid() = user_id);

create index if not exists preventive_cares_pet_idx on public.preventive_cares (pet_id, next_due_date);
create index if not exists preventive_cares_due_idx on public.preventive_cares (next_due_date) where alarm_enabled = true;
