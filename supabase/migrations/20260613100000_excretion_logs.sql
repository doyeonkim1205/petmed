-- 대소변 기록 (배변/배뇨) — 상태(굳기·색)는 범주형이라 숫자 전용 health_metrics 와 분리.
--
-- kind: poop(대변) / pee(소변)
-- condition: 상태 코드 (kind 별로 의미 다름)
--   poop → normal(정상)/soft(무름)/diarrhea(설사)/hard(딱딱함)/blood(혈변)
--   pee  → normal(정상)/dark(진함)/blood(붉음)/cloudy(탁함)/none(거의 못 봄)
-- amount: 양 — less(적음)/normal(보통)/more(많음). nullable(선택).
-- color: 대변 색 — brown/black/red/yellow/gray. nullable(소변은 미사용).
-- measured_at: 시각 포함(timestamptz) — 타임라인에 "09:20" 노출용. 기본 now()(빠른 입력).
-- 횟수는 날짜별 row 수로 집계.

create table if not exists public.excretion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  kind text not null check (kind in ('poop', 'pee')),
  condition text not null,
  amount text,
  color text,
  memo text,
  measured_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.excretion_logs enable row level security;

create policy excretion_logs_select_own on public.excretion_logs
  for select using (auth.uid() = user_id);
create policy excretion_logs_insert_own on public.excretion_logs
  for insert with check (auth.uid() = user_id);
create policy excretion_logs_update_own on public.excretion_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy excretion_logs_delete_own on public.excretion_logs
  for delete using (auth.uid() = user_id);

create index if not exists excretion_logs_pet_kind_idx
  on public.excretion_logs (pet_id, kind, measured_at);
