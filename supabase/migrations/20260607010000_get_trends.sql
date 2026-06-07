-- Admin 대시보드 트래픽 추세 그래프용 시계열 집계 RPC.
--
-- 가입(profiles) / 검색(search_logs) / 매출(payment_history status='done') 을
-- KST 기준 일/주/월 버킷으로 집계하고, 데이터 없는 구간도 0 으로 gap-fill.
--
-- KST 처리: created_at(timestamptz) AT TIME ZONE 'Asia/Seoul' → KST 벽시계 timestamp,
--   date_trunc 로 버킷. 서버(UTC)에서도 한국 달력 기준으로 정확히 끊김.
-- 안전장치: bucket 화이트리스트(아니면 day), count 1~366 clamp (series 폭주 방지).
-- SECURITY DEFINER + service_role 전용 (admin 라우트).

CREATE OR REPLACE FUNCTION public.get_trends(p_bucket text, p_count int)
RETURNS TABLE(bucket text, signups bigint, searches bigint, revenue bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket   text      := CASE WHEN p_bucket IN ('day','week','month') THEN p_bucket ELSE 'day' END;
  v_count    int       := LEAST(GREATEST(COALESCE(p_count, 30), 1), 366);
  v_interval interval  := ('1 ' || v_bucket)::interval;
  v_now      timestamp := date_trunc(v_bucket, (now() AT TIME ZONE 'Asia/Seoul'));
BEGIN
  RETURN QUERY
  WITH series AS (
    SELECT generate_series(v_now - v_interval * (v_count - 1), v_now, v_interval) AS b
  ),
  sign AS (
    SELECT date_trunc(v_bucket, created_at AT TIME ZONE 'Asia/Seoul') AS b, COUNT(*)::bigint AS c
    FROM public.profiles GROUP BY 1
  ),
  srch AS (
    SELECT date_trunc(v_bucket, created_at AT TIME ZONE 'Asia/Seoul') AS b, COUNT(*)::bigint AS c
    FROM public.search_logs GROUP BY 1
  ),
  rev AS (
    SELECT date_trunc(v_bucket, created_at AT TIME ZONE 'Asia/Seoul') AS b, COALESCE(SUM(amount),0)::bigint AS c
    FROM public.payment_history WHERE status = 'done' GROUP BY 1
  )
  SELECT
    to_char(s.b, 'YYYY-MM-DD'),
    COALESCE(sign.c, 0),
    COALESCE(srch.c, 0),
    COALESCE(rev.c, 0)
  FROM series s
  LEFT JOIN sign ON sign.b = s.b
  LEFT JOIN srch ON srch.b = s.b
  LEFT JOIN rev  ON rev.b  = s.b
  ORDER BY s.b;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trends(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trends(text, int) TO service_role;
