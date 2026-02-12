-- ========================================
-- Ensure SELECT policies exist for all tables
-- Without these, authenticated users can't read their own data
-- ========================================

-- profiles: allow users to read all profiles (for displaying names, avatars)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- health_records: users can only read their own records
DROP POLICY IF EXISTS "health_records_select_own" ON health_records;
CREATE POLICY "health_records_select_own" ON health_records
  FOR SELECT USING (auth.uid() = user_id);

-- medications: users can only read their own medications
DROP POLICY IF EXISTS "medications_select_own" ON medications;
CREATE POLICY "medications_select_own" ON medications
  FOR SELECT USING (auth.uid() = user_id);

-- record_files: users can only read their own files
DROP POLICY IF EXISTS "record_files_select_own" ON record_files;
CREATE POLICY "record_files_select_own" ON record_files
  FOR SELECT USING (auth.uid() = user_id);

-- pets: users can only read their own pets
DROP POLICY IF EXISTS "pets_select_own" ON pets;
CREATE POLICY "pets_select_own" ON pets
  FOR SELECT USING (auth.uid() = user_id);

-- medication_checks: users can only read their own checks
DROP POLICY IF EXISTS "med_checks_select_own" ON medication_checks;
CREATE POLICY "med_checks_select_own" ON medication_checks
  FOR SELECT USING (auth.uid() = user_id);

-- posts: everyone can read posts (community feature)
DROP POLICY IF EXISTS "posts_select_all" ON posts;
CREATE POLICY "posts_select_all" ON posts
  FOR SELECT USING (true);

-- comments: everyone can read comments
DROP POLICY IF EXISTS "comments_select_all" ON comments;
CREATE POLICY "comments_select_all" ON comments
  FOR SELECT USING (true);
