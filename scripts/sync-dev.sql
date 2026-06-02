-- DEV DB 와 PROD DB 의 스키마 차이를 메우는 마이그레이션
-- 생성: 2026-06-02
-- 적용 대상: lzmmiksdvioidcldrnvh (pawdex-dev)
-- 멱등성: 모든 문장이 IF NOT EXISTS / OR REPLACE 사용

BEGIN;

-- ── 1. subscription_events 테이블 신규 ──
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type = ANY (ARRAY['purchase'::text, 'renew'::text, 'cancel'::text, 'refund'::text, 'expired'::text, 'downgrade'::text, 'upgrade'::text])),
  plan TEXT NOT NULL CHECK (plan = ANY (ARRAY['basic'::text, 'premium'::text])),
  amount INTEGER NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON public.subscription_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON public.subscription_events (event_type, created_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.subscription_events;
CREATE POLICY "Service role full access" ON public.subscription_events
  FOR ALL USING (auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "Users can view own events" ON public.subscription_events;
CREATE POLICY "Users can view own events" ON public.subscription_events
  FOR SELECT USING (auth.uid() = user_id);

-- ── 2. Column 정밀 차이 보정 ──
ALTER TABLE public.activity_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.search_logs ALTER COLUMN kind SET DEFAULT 'disease';

-- ── 3. 누락 함수 ──
CREATE OR REPLACE FUNCTION public.dedup_auth_login()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF NEW.action = 'auth.login' AND NEW.user_id IS NOT NULL THEN IF EXISTS (SELECT 1 FROM activity_logs WHERE user_id = NEW.user_id AND action = 'auth.login' AND created_at > COALESCE(NEW.created_at, NOW()) - INTERVAL '1 minute' LIMIT 1) THEN RETURN NULL; END IF; END IF; RETURN NEW; END; $function$
;

-- ⚠️ dev DB 에는 pg_cron extension 이 설치되지 않아 PROD 의 정의 그대로 못 가져옴.
--    dev 용 stub — admin 페이지의 cron 통계 카드가 dev 에선 항상 빈 결과 반환.
CREATE OR REPLACE FUNCTION public.get_cron_last_run(p_jobname text)
 RETURNS TABLE(start_time timestamp with time zone, status text)
 LANGUAGE sql
AS $function$
  SELECT NULL::timestamptz, 'no-cron-in-dev'::text WHERE FALSE;
$function$;

-- ⚠️ PROD 의 prevent_role_change 함수에 깨진 한글 메시지가 저장되어 있어
--    sync 시 깔끔한 한글로 다시 작성. PROD 도 별도로 fix 해야 함.
CREATE OR REPLACE FUNCTION public.prevent_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'anon'
     AND OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'role 변경 권한이 없습니다.';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 4. 누락 인덱스 ──
CREATE UNIQUE INDEX IF NOT EXISTS active_sessions_user_id_device_id_key ON public.active_sessions USING btree (user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON public.active_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created ON public.activity_logs USING btree (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_analyses_user ON public.saved_analyses USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_papers_analysis ON public.saved_papers USING btree (analysis_id);
CREATE INDEX IF NOT EXISTS idx_saved_papers_user ON public.saved_papers USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_cache_created ON public.search_cache USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_key ON public.search_cache USING btree (cache_key);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_date ON public.search_logs USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS medication_checks_med_date_dose_key ON public.medication_checks USING btree (medication_id, check_date, dose_number);
CREATE UNIQUE INDEX IF NOT EXISTS search_cache_cache_key_key ON public.search_cache USING btree (cache_key);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key ON public.subscriptions USING btree (user_id);

-- ── 5. 누락 CHECK constraints ──
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_type_check') THEN
    ALTER TABLE pets ADD CONSTRAINT pets_type_check CHECK ((type = ANY (ARRAY['dog'::text, 'cat'::text])));
  END IF;
END $do$;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'expired'::text])));
  END IF;
END $do$;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_history_status_check') THEN
    ALTER TABLE payment_history ADD CONSTRAINT payment_history_status_check CHECK ((status = ANY (ARRAY['done'::text, 'canceled'::text, 'refunded'::text])));
  END IF;
END $do$;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));
  END IF;
END $do$;

-- ── 6. 누락 RLS 정책 (PROD 의 세분화된 정책 — DEV 의 users_own 통합 정책과 공존) ──
DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can read all activity logs" ON public.activity_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert own activity logs" ON public.activity_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view own activity logs" ON public.activity_logs FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "health_records_delete_own" ON public.health_records;
CREATE POLICY "health_records_delete_own" ON public.health_records FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "health_records_insert_own" ON public.health_records;
CREATE POLICY "health_records_insert_own" ON public.health_records FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "health_records_select_own" ON public.health_records;
CREATE POLICY "health_records_select_own" ON public.health_records FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "health_records_update_own" ON public.health_records;
CREATE POLICY "health_records_update_own" ON public.health_records FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "med_checks_delete_own" ON public.medication_checks;
CREATE POLICY "med_checks_delete_own" ON public.medication_checks FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "med_checks_insert_own" ON public.medication_checks;
CREATE POLICY "med_checks_insert_own" ON public.medication_checks FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "med_checks_select_own" ON public.medication_checks;
CREATE POLICY "med_checks_select_own" ON public.medication_checks FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "med_checks_update_own" ON public.medication_checks;
CREATE POLICY "med_checks_update_own" ON public.medication_checks FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "medications_delete_own" ON public.medications;
CREATE POLICY "medications_delete_own" ON public.medications FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "medications_insert_own" ON public.medications;
CREATE POLICY "medications_insert_own" ON public.medications FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "medications_select_own" ON public.medications;
CREATE POLICY "medications_select_own" ON public.medications FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "medications_update_own" ON public.medications;
CREATE POLICY "medications_update_own" ON public.medications FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own payment history" ON public.payment_history;
CREATE POLICY "Users can view own payment history" ON public.payment_history FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "pets_delete_own" ON public.pets;
CREATE POLICY "pets_delete_own" ON public.pets FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "pets_insert_own" ON public.pets;
CREATE POLICY "pets_insert_own" ON public.pets FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "pets_select_own" ON public.pets;
CREATE POLICY "pets_select_own" ON public.pets FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "pets_update_own" ON public.pets;
CREATE POLICY "pets_update_own" ON public.pets FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Service role full access push" ON public.push_subscriptions;
CREATE POLICY "Service role full access push" ON public.push_subscriptions FOR ALL USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Users manage own subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own subs" ON public.push_subscriptions FOR ALL USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "record_files_delete_own" ON public.record_files;
CREATE POLICY "record_files_delete_own" ON public.record_files FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "record_files_insert_own" ON public.record_files;
CREATE POLICY "record_files_insert_own" ON public.record_files FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "record_files_select_own" ON public.record_files;
CREATE POLICY "record_files_select_own" ON public.record_files FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "record_files_update_own" ON public.record_files;
CREATE POLICY "record_files_update_own" ON public.record_files FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own saved analyses" ON public.saved_analyses;
CREATE POLICY "Users can delete own saved analyses" ON public.saved_analyses FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own saved analyses" ON public.saved_analyses;
CREATE POLICY "Users can insert own saved analyses" ON public.saved_analyses FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own saved analyses" ON public.saved_analyses;
CREATE POLICY "Users can read own saved analyses" ON public.saved_analyses FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "saved_papers_delete" ON public.saved_papers;
CREATE POLICY "saved_papers_delete" ON public.saved_papers FOR DELETE USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "saved_papers_insert" ON public.saved_papers;
CREATE POLICY "saved_papers_insert" ON public.saved_papers FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "saved_papers_select" ON public.saved_papers;
CREATE POLICY "saved_papers_select" ON public.saved_papers FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can read all search logs" ON public.search_logs;
CREATE POLICY "Admins can read all search logs" ON public.search_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Users can insert own search logs" ON public.search_logs;
CREATE POLICY "Users can insert own search logs" ON public.search_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own search logs" ON public.search_logs;
CREATE POLICY "Users can read own search logs" ON public.search_logs FOR SELECT USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));

COMMIT;
