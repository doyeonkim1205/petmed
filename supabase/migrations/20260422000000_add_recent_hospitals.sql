-- 최근 입력한 병원명 자동완성용 테이블.
-- 기존에는 localStorage 에 저장했지만 기기/브라우저별로 분리돼서 PWA ↔ 일반
-- 브라우저, 폰 ↔ PC 간 동기화가 안 되던 문제를 DB 저장으로 해결.
CREATE TABLE IF NOT EXISTS recent_hospitals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 병원명 자동완성 쿼리는 "내 것만, 최근순, 10개" 이므로 복합 인덱스가 유리.
CREATE INDEX IF NOT EXISTS idx_recent_hospitals_user_recent
  ON recent_hospitals(user_id, last_used_at DESC);

ALTER TABLE recent_hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recent hospitals" ON recent_hospitals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access recent hospitals" ON recent_hospitals
  FOR ALL USING (auth.role() = 'service_role');
