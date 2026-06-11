-- health_metrics / expenses 에 FK(on delete cascade) 추가.
-- 펫·유저 삭제 시 관련 지표/지출 행이 남아(orphan) 의료비 "전체" 합계 등에 섞이는 것 방지.
-- (개발·운영 DB 양쪽 API 로 적용 완료 — 이 파일은 기록용)

-- 혹시 남은 orphan 정리 후 FK 부여 (테이블 비어있으면 no-op)
delete from public.health_metrics where pet_id not in (select id from public.pets);
delete from public.expenses where pet_id not in (select id from public.pets);

alter table public.health_metrics drop constraint if exists health_metrics_pet_id_fkey;
alter table public.health_metrics add constraint health_metrics_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.health_metrics drop constraint if exists health_metrics_user_id_fkey;
alter table public.health_metrics add constraint health_metrics_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.expenses drop constraint if exists expenses_pet_id_fkey;
alter table public.expenses add constraint expenses_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.expenses drop constraint if exists expenses_user_id_fkey;
alter table public.expenses add constraint expenses_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
