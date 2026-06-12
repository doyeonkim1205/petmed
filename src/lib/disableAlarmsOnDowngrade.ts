import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Plus → Free 전환 시 알림 상태 정리.
 *
 * 무료 유저는 푸시 cron(paidSet 필터)에서 어차피 발송 제외되지만, DB 의
 * medications.alarm_enabled / profiles.is_push_enabled 가 켜진 채로 남으면
 * 복약 관리·마이페이지 UI 가 "알림 ON" 으로 보여 "알림 받는 줄" 오해를 줌.
 * → DB 상태를 현실(무료=알림 없음)에 맞춰 OFF 로 정리해 UI 를 정직하게 만든다.
 *
 * - medications.alarm_enabled = false (해당 유저의 모든 약)
 * - profiles.is_push_enabled  = false
 *
 * 멱등(이미 false 여도 무해)이라 모든 다운그레이드 경로에서 반복 호출해도 안전.
 * service-role(admin) 클라이언트로 호출할 것.
 */
export async function disableAlarmsOnDowngrade(
  admin: SupabaseClient,
  userIds: string | string[],
): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;

  await admin
    .from('medications')
    .update({ alarm_enabled: false })
    .in('user_id', ids)
    .eq('alarm_enabled', true);

  await admin
    .from('profiles')
    .update({ is_push_enabled: false })
    .in('id', ids);
}
