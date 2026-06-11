-- 지출(의료비 등) 직접 입력 — weight_logs 패턴 미러링.
--
-- category: 지금은 'medical'(의료비)만 사용. 나중에 'food'/'toy' 등 추가하면 가계부로 확장.
-- reason: 지출 사유 (기록의 진료/입원 사유 자리와 동일 역할 → 목록 타이틀).
-- 기록(health_records.cost)과 별개로, 진료/입퇴원 기록 없이 약·수액 등 구매 비용을 직접 입력.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid not null,
  category text not null default 'medical',
  reason text not null default '',
  amount numeric not null,
  spent_at date not null default current_date,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy expenses_select_own on public.expenses
  for select using (auth.uid() = user_id);
create policy expenses_insert_own on public.expenses
  for insert with check (auth.uid() = user_id);
create policy expenses_update_own on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy expenses_delete_own on public.expenses
  for delete using (auth.uid() = user_id);

create index if not exists expenses_pet_idx on public.expenses (pet_id, category, spent_at);
