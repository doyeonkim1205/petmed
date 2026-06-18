-- 방어심층(defense-in-depth): 결제 테이블에서 클라이언트 역할의 '안 쓰는' 권한 회수.
--
-- subscriptions / payment_history 는 RLS 가 SELECT 정책만 가져서 클라이언트(authenticated/anon)
-- 쓰기가 이미 막혀 있다. 다만 테이블 레벨로 INSERT/UPDATE/DELETE 뿐 아니라 TRUNCATE/TRIGGER 까지
-- GRANT 되어 있어(과거 GRANT ALL 흔적으로 추정), 향후 실수로 쓰기 RLS 정책이 추가되거나
-- 권한 모델이 바뀌면 위변조 여지가 생긴다.
-- → 클라 역할에서 전부 회수하고 authenticated 에 SELECT 만 다시 부여(RLS 로 본인 행 조회).
--
-- 결제 쓰기는 전부 service_role(서버 API/웹훅/크론)이 수행하며 service_role 은 영향받지 않음.

REVOKE ALL ON public.subscriptions   FROM authenticated, anon;
REVOKE ALL ON public.payment_history  FROM authenticated, anon;

GRANT SELECT ON public.subscriptions  TO authenticated;
GRANT SELECT ON public.payment_history TO authenticated;
