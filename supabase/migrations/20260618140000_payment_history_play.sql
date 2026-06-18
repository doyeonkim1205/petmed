-- payment_history: Play(앱) 결제내역도 기록 가능하게 확장.
--
-- 기존엔 토스 전용(toss_payment_key/toss_order_id NOT NULL)이라 RC(Play) 결제를 기록할 수 없었다.
-- RC 웹훅이 INITIAL_PURCHASE/RENEWAL 등 실제 결제 이벤트를 payment_history 에 남길 수 있도록:
--  - 토스 전용 컬럼을 nullable 로 (Play 결제엔 없음)
--  - store / provider_payment_id 추가 (출처 구분 + 멱등 키)

ALTER TABLE public.payment_history ALTER COLUMN toss_payment_key DROP NOT NULL;
ALTER TABLE public.payment_history ALTER COLUMN toss_order_id   DROP NOT NULL;

ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS store text NOT NULL DEFAULT 'toss';
ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS provider_payment_id text;

-- 웹훅 재전송 시 중복 기록 방지 (provider_payment_id 가 있을 때만 유니크).
CREATE UNIQUE INDEX IF NOT EXISTS payment_history_provider_payment_id_key
  ON public.payment_history (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
