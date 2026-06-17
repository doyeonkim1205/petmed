-- Play Billing(RevenueCat) 대비: subscriptions 에 결제 스토어/프로바이더 메타 추가.
--   웹 = 토스 (store='toss'), 앱 = Google Play (store='play'). iOS 대비 'apple' 예약.
--   profiles.plan 은 권한의 단일 진실원으로 유지 — 웹(토스 confirm)·앱(RC 웹훅) 둘 다 갱신.
-- 모두 additive + 기존 행은 store='toss' 기본값이라 비파괴적.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS store text NOT NULL DEFAULT 'toss',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,  -- RC/Play 구독 식별자 (original_transaction_id 등)
  ADD COLUMN IF NOT EXISTS provider_customer_id text,      -- RC app_user_id (= supabase user id)
  ADD COLUMN IF NOT EXISTS entitlement_id text,            -- RC entitlement (예: 'plus')
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;      -- 마지막 RC 웹훅 이벤트 시각 (순서·멱등 처리)

DO $$
BEGIN
  ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_store_check;
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_store_check
    CHECK (store IN ('toss', 'play', 'apple'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 웹훅에서 provider_subscription_id 로 구독 행을 찾을 때 사용.
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub
  ON public.subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
