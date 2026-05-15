-- 2026-04-20: activity_logs dedup + decouple from auth.users
--
-- Applied via Supabase Management API directly on production DB.
-- Commit this file as historical record of the migration.
--
-- Context:
--   1. auth.login spam (up to 7 rows per real sign-in) because of
--      multi-tab / OAuth callback refiring. Client-side dedup via
--      localStorage couldn't win the cross-tab race — concurrent
--      tabs all read null before any writes.
--   2. "탈퇴 유저만" filter in admin was empty because activity_logs
--      had ON DELETE CASCADE to auth.users. Deleting a user wiped
--      all audit trail, even after we removed the explicit DELETE.
--   3. search_logs and activity_logs both tracked symptoms — same
--      data in two places, messy admin view.

-- 1) Drop CASCADE so audit logs outlive the user.
ALTER TABLE activity_logs
  DROP CONSTRAINT activity_logs_user_id_fkey;
-- Intentionally no replacement FK. Logs can reference gone auth.users
-- ids (those rows become pseudonymized per the privacy notice).

-- 2) Add kind column to search_logs; unify symptom + disease.
ALTER TABLE search_logs
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'disease'
    CHECK (kind IN ('disease', 'symptom', 'symptom_refine'));

-- 3) Migrate symptom rows out of activity_logs into search_logs.
INSERT INTO search_logs (user_id, query, pet_type, kind, created_at)
SELECT user_id,
       COALESCE(details->>'symptoms', '') AS query,
       COALESCE(details->>'petType', 'dog') AS pet_type,
       CASE WHEN action = 'symptom.refine' THEN 'symptom_refine'
            ELSE 'symptom' END AS kind,
       created_at
FROM activity_logs
WHERE action IN ('symptom.search', 'symptom.refine')
  AND COALESCE(details->>'petType','') IN ('dog','cat');

DELETE FROM activity_logs
WHERE action IN ('symptom.search', 'symptom.refine');

-- 4) Dedup auth.login at DB level — trigger version.
-- date_trunc isn't IMMUTABLE in an expression index, so we use a
-- BEFORE INSERT trigger instead. One auth.login per user per minute.
CREATE OR REPLACE FUNCTION dedup_auth_login() RETURNS trigger AS $$
BEGIN
  IF NEW.action = 'auth.login' AND NEW.user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM activity_logs
      WHERE user_id = NEW.user_id
        AND action = 'auth.login'
        AND created_at > COALESCE(NEW.created_at, NOW()) - INTERVAL '1 minute'
      LIMIT 1
    ) THEN
      RETURN NULL; -- silently drop dup
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dedup_auth_login ON activity_logs;
CREATE TRIGGER trg_dedup_auth_login
  BEFORE INSERT ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION dedup_auth_login();

-- 5) Historical cleanup — deduped existing rows
-- WITH d AS (
--   SELECT id, ROW_NUMBER() OVER (
--     PARTITION BY user_id, date_trunc('minute', created_at)
--     ORDER BY created_at
--   ) AS rn
--   FROM activity_logs WHERE action = 'auth.login'
-- )
-- DELETE FROM activity_logs WHERE id IN (SELECT id FROM d WHERE rn > 1);
-- (345 rows removed on production, leaving 758)
