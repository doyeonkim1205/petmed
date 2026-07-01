-- 2026-07-01  drop subscriptions.reminder_3day_sent_at (dead column)
--
-- 리마인더 멱등성이 notification_logs 로 완전히 이전(2026-07-01_notification_logs.sql)되어
-- subscriptions.reminder_3day_sent_at 는 코드 참조 0 인 dead 컬럼이 됨.
-- 이를 참조하던 진단/테스트 스크립트도 정리 완료:
--   - 삭제: scripts/add-reminder-columns.mjs, verify-reminder-column.mjs, test-reminder-query.mjs
--   - 수정: scripts/test-billing-cron.mjs (reminder_3day_sent_at 참조 제거)
--
-- 적용: dev(lzmmiksdvioidcldrnvh) + prod(ylbxtzwbwbnlmfxqgmoz) 에 Management API 로 적용.
-- IF EXISTS 라 재실행 안전.

alter table public.subscriptions drop column if exists reminder_3day_sent_at;
