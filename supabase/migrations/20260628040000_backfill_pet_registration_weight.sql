-- 펫 등록 무게를 weight_logs(히스토리)에 백필.
--
-- 배경: 기존엔 펫 등록/프로필 무게가 pets.weight 에만 저장되고 weight_logs(히스토리)엔
-- 안 남았음. 체중 모델을 "weight_logs=진실원 + pets.weight=최신 캐시"로 정리하면서,
-- 로그가 하나도 없는 기존 펫의 등록 무게를 created_at 날짜로 첫 기록으로 보존(차트 시작점).
--
-- 추가(INSERT)만 하므로 안전. 이미 로그가 있는 펫은 건드리지 않음.
-- dev(lzmmiksdvioidcldrnvh): 대상 0건. prod(ylbxtzwbwbnlmfxqgmoz): 2026-06-28 적용.

INSERT INTO weight_logs (user_id, pet_id, weight, measured_at)
SELECT p.user_id, p.id, p.weight, p.created_at::date
FROM pets p
WHERE p.weight IS NOT NULL AND p.weight > 0
  AND NOT EXISTS (SELECT 1 FROM weight_logs wl WHERE wl.pet_id = p.id);
