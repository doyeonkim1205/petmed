-- Activity Logs: 사용자 행동 추적용 테이블
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_logs_user_created ON activity_logs (user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action_created ON activity_logs (action, created_at DESC);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);
