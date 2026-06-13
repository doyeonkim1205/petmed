-- 식사·수액 "1회 정량" + % 입력 기록 보존.
--
-- metric_targets: 펫별 현재 1회 기준량 (식사 g/끼, 수액 ml/회). metric_type 은
--   health_metrics 와 동일 키('food'/'fluid')로 연결. (수액은 기존대로 'fluid' 유지)
-- health_metrics 보강(nullable):
--   input_pct        — % 버튼으로 입력한 비율(100/75/50/25/0). 직접 g 입력이면 null.
--   serving_snapshot — 입력 당시 1회 정량(나중에 정량 바뀌어도 과거 % 보존). 정량 미설정이면 null.
--   value(그램)는 그대로 → 기존 통계/그래프 100% 호환.

create table if not exists public.metric_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  metric_type text not null check (metric_type in ('food', 'fluid')),
  serving numeric not null,
  unit text not null default 'g',
  updated_at timestamptz default now(),
  unique (pet_id, metric_type)
);

alter table public.metric_targets enable row level security;

create policy metric_targets_select_own on public.metric_targets
  for select using (auth.uid() = user_id);
create policy metric_targets_insert_own on public.metric_targets
  for insert with check (auth.uid() = user_id);
create policy metric_targets_update_own on public.metric_targets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy metric_targets_delete_own on public.metric_targets
  for delete using (auth.uid() = user_id);

alter table public.health_metrics add column if not exists input_pct smallint;
alter table public.health_metrics add column if not exists serving_snapshot numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'health_metrics_input_pct_chk') then
    alter table public.health_metrics
      add constraint health_metrics_input_pct_chk check (input_pct in (0, 25, 50, 75, 100));
  end if;
end $$;
