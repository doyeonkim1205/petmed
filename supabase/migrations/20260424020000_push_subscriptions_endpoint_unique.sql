-- push_subscriptions endpoint 글로벌 유니크 변경.
--
-- 문제: 기존 constraint 는 (user_id, endpoint) 복합 유니크. 같은 기기
--       endpoint 가 여러 user_id 아래 공존 가능해 "기기 소유권"이 DB 에서
--       제대로 관리 안 됨.
-- 증상: 공유 기기에서 계정 전환하면 이전 사용자 알림이 새 사용자 기기에
--       계속 배달 → 민감 정보(약 이름, 진료 예약) 타인 노출 위험.
-- 수정: endpoint 단독 UNIQUE. 같은 endpoint 에 다른 user_id 가 upsert 시도
--       하면 user_id 덮어쓰기 → 소유권 자동 이전.
--
-- dedup: 기존 중복 endpoint 가 있으면 가장 최근 것만 유지.
--        (현재 DB 에는 중복 없지만 방어적으로 포함)

-- 1) 중복 정리 — 같은 endpoint 여러 row 있으면 가장 최근만 남김
DELETE FROM push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (endpoint) id
  FROM push_subscriptions
  ORDER BY endpoint, created_at DESC
);

-- 2) 기존 composite 유니크 제거
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

-- 3) endpoint 단독 유니크 추가
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
