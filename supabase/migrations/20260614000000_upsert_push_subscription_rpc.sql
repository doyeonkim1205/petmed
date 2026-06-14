-- push_subscriptions upsert + "신규 insert 여부" 원자적 반환 RPC.
--
-- 배경: /api/push/subscribe 는 매 POST 마다 activity_logs 에 push.subscribe 를
--   무조건 남겼다. 그런데 AuthContext 의 auto-resub 가 앱 진입/포그라운드 복귀
--   (visibilitychange)마다 동일 endpoint 를 재-upsert 하므로, 유료+권한허용
--   유저 1명이 하루에 "알림 구독" 로그를 수십 건씩 만들어 활동로그가 오염됐다.
--   (구독자 수/통계는 push_subscriptions row 기준이라 이 로그에 의존 X)
--
-- 해결: select 후 insert 2단계는 동시 호출(visibilitychange+permchange 거의
--   동시 발화) 시 둘 다 "없음"으로 보고 둘 다 로그하는 race 가 있다. 그래서
--   INSERT ... ON CONFLICT ... RETURNING (xmax = 0) 단일 원자 문장으로 처리.
--   - 신규 INSERT → xmax = 0 → true
--   - 기존 endpoint UPDATE(=재동기화) → xmax != 0 → false
--   라우트는 true 일 때만 push.subscribe 활동 로그를 남긴다.
--
-- 기능 영향 없음: DB upsert(self-heal 동기화)는 그대로, 로그만 신규로 한정.

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_new boolean;
BEGIN
  INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
  VALUES (p_user_id, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        keys_p256dh = EXCLUDED.keys_p256dh,
        keys_auth = EXCLUDED.keys_auth
  RETURNING (xmax = 0) INTO v_is_new;
  RETURN v_is_new;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(uuid, text, text, text) TO service_role;
