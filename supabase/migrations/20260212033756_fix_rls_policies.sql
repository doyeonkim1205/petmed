-- ========================================
-- Fix RLS policies for all tables
-- Ensures authenticated users can perform CRUD on their own data
-- ========================================

-- ─── profiles ───────────────────────────
-- Profile owner can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Profile owner can delete their own profile
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- ─── health_records ─────────────────────
DROP POLICY IF EXISTS "health_records_insert_own" ON health_records;
CREATE POLICY "health_records_insert_own" ON health_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "health_records_update_own" ON health_records;
CREATE POLICY "health_records_update_own" ON health_records
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "health_records_delete_own" ON health_records;
CREATE POLICY "health_records_delete_own" ON health_records
  FOR DELETE USING (auth.uid() = user_id);

-- ─── medications ────────────────────────
DROP POLICY IF EXISTS "medications_insert_own" ON medications;
CREATE POLICY "medications_insert_own" ON medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medications_update_own" ON medications;
CREATE POLICY "medications_update_own" ON medications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medications_delete_own" ON medications;
CREATE POLICY "medications_delete_own" ON medications
  FOR DELETE USING (auth.uid() = user_id);

-- ─── record_files ───────────────────────
DROP POLICY IF EXISTS "record_files_insert_own" ON record_files;
CREATE POLICY "record_files_insert_own" ON record_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "record_files_update_own" ON record_files;
CREATE POLICY "record_files_update_own" ON record_files
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "record_files_delete_own" ON record_files;
CREATE POLICY "record_files_delete_own" ON record_files
  FOR DELETE USING (auth.uid() = user_id);

-- ─── pets ───────────────────────────────
DROP POLICY IF EXISTS "pets_insert_own" ON pets;
CREATE POLICY "pets_insert_own" ON pets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_update_own" ON pets;
CREATE POLICY "pets_update_own" ON pets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_delete_own" ON pets;
CREATE POLICY "pets_delete_own" ON pets
  FOR DELETE USING (auth.uid() = user_id);

-- ─── posts ──────────────────────────────
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- ─── comments ───────────────────────────
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- ─── medication_checks ──────────────────
DROP POLICY IF EXISTS "med_checks_insert_own" ON medication_checks;
CREATE POLICY "med_checks_insert_own" ON medication_checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "med_checks_update_own" ON medication_checks;
CREATE POLICY "med_checks_update_own" ON medication_checks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "med_checks_delete_own" ON medication_checks;
CREATE POLICY "med_checks_delete_own" ON medication_checks
  FOR DELETE USING (auth.uid() = user_id);
