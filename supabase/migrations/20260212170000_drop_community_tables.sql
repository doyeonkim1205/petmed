-- ========================================
-- Remove community feature completely
-- Drop posts and comments tables
-- ========================================

-- Drop all policies first
DROP POLICY IF EXISTS "posts_select_all" ON posts;
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
DROP POLICY IF EXISTS "posts_update_own" ON posts;
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
DROP POLICY IF EXISTS "comments_select_all" ON comments;
DROP POLICY IF EXISTS "comments_insert_own" ON comments;
DROP POLICY IF EXISTS "comments_update_own" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;

-- Drop tables (comments first due to foreign key)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
