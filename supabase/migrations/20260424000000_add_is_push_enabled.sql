-- 사용자의 푸시 알림 수신 의사를 DB 로 관리.
-- null = 미결정 (새 유저 or 아직 마이페이지 토글 안 건드린 유저)
-- true = 명시적 ON (마이페이지에서 켜거나 auto-resub 가 확정한 경우)
-- false = 명시적 OFF (마이페이지에서 직접 끔)
--
-- 사용 목적:
--   1) auto-resub: permission=granted + sub=null + is_push_enabled !== false 조합이면 조용히 재구독
--   2) 기기 간 의사 공유: 폰에서 OFF 눌러도 PC 에서 동일하게 존중
--   3) Cron 발송 분기 (향후): is_push_enabled === false 면 push_subscriptions 에 row 남아도 발송 안 함
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_push_enabled BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN profiles.is_push_enabled IS
  'User intent for push notifications. null=undecided, true=opted in, false=explicitly opted out.';
