-- 펫 등록 한도 DB 트리거 제거.
--
-- 배경: enforce_pet_limit 트리거(check_pet_limit())가 무료 플랜 max_pets := 2 를
-- 하드코딩해 3번째 펫 INSERT 를 DB 단에서 거부 → 앱은 "등록에 실패했습니다"만 표시.
-- 코드 한도는 free 5 / plus 무제한(plans.ts)으로 올렸는데 DB 트리거가 2 에서 막아
-- 코드↔DB 불일치 + 정체불명 에러 발생.
--
-- 정책: 플랜 제한은 "코드"에서만 (앱 모달). DB 트리거로 두지 않는다.
-- (2026-06-12 무료 기록 한도 트리거 제거와 동일 원칙. 펫 트리거가 누락돼 있었음)
--
-- prod(ylbxtzwbwbnlmfxqgmoz) / dev(lzmmiksdvioidcldrnvh) 양쪽에 2026-06-28 적용 완료.

DROP TRIGGER IF EXISTS enforce_pet_limit ON public.pets;
DROP FUNCTION IF EXISTS public.check_pet_limit();
