-- 건강 지표 트래킹 (음수량/식사량/수액) — weight_logs 패턴 미러링.
--
-- metric_type: water(음수 ml) / food(식사 g) / fluid(수액 ml, 가정 피하수액 등)
-- value: 그날 총량. 하루 여러 번 입력 시 날짜별 합산해서 그래프 표시.
-- 체중(weight_logs)과 분리 — 체중은 기존 테이블 유지, 신규 지표만 여기에.

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid not null,
  metric_type text not null check (metric_type in ('water', 'food', 'fluid')),
  value numeric not null,
  unit text not null default 'ml',
  measured_at date not null default current_date,
  created_at timestamptz default now()
);

alter table public.health_metrics enable row level security;

create policy health_metrics_select_own on public.health_metrics
  for select using (auth.uid() = user_id);
create policy health_metrics_insert_own on public.health_metrics
  for insert with check (auth.uid() = user_id);
create policy health_metrics_update_own on public.health_metrics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy health_metrics_delete_own on public.health_metrics
  for delete using (auth.uid() = user_id);

create index if not exists health_metrics_pet_type_idx
  on public.health_metrics (pet_id, metric_type, measured_at);
