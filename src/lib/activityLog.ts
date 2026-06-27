import { supabase } from '@/lib/supabase';

interface LogOptions {
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

/**
 * 클라이언트 활동 로거 (anon key + RLS).
 * 기본은 fire-and-forget 이지만 Promise 를 반환하므로, 직후 화면 전환/세션 정리로
 * 요청이 중단될 수 있는 경우(예: 로그아웃·회원가입)엔 호출부에서 await 할 것.
 * 절대 throw 하지 않음 — 실패는 console 로만.
 *
 * ⚠️ 서버(API 라우트/cron)에서는 유저 세션이 없어 RLS 에 막히므로
 *    이 함수가 아니라 logActivityServer(@/lib/activityLogServer) 를 써야 한다.
 */
export function logActivity(
  userId: string,
  action: string,
  opts?: LogOptions,
): PromiseLike<void> {
  return supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      action,
      resource_type: opts?.resourceType ?? null,
      resource_id: opts?.resourceId ?? null,
      details: opts?.details ?? {},
    })
    .then(({ error }) => {
      if (error) console.error('activity log failed:', error.message);
    });
}
