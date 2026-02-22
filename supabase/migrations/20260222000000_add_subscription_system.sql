-- Add plan column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Search logs for rate limiting
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'dog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_date ON search_logs(user_id, created_at);

-- Saved analyses for premium users
CREATE TABLE IF NOT EXISTS saved_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'dog',
  articles JSONB NOT NULL DEFAULT '[]',
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_analyses_user ON saved_analyses(user_id, created_at DESC);

-- RLS policies
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own search logs" ON search_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own search logs" ON search_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved analyses" ON saved_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own saved analyses" ON saved_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved analyses" ON saved_analyses FOR DELETE USING (auth.uid() = user_id);
