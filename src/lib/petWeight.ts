import { supabase } from './supabase';
import { todayLocalISO } from './date';

/**
 * 체중 단일 진실원 = weight_logs(히스토리). pets.weight = 최신 weight_log 캐시.
 *
 * 펫 등록·프로필 무게 수정·체중 탭 입력이 전부 weight_logs 를 거치고, 직후
 * syncPetWeightCache 로 pets.weight 를 최신값에 맞춘다. 그러면:
 *  - 등록 무게도 히스토리(차트 시작점)로 보존
 *  - 음수/식사 적정량(MetricTracker, 이미 최신 로그 기준)과 AI(pets.weight 사용)가 일치
 *  - 백데이트/삭제도 "재계산"이라 캐시가 꼬이지 않음
 */

/** 체중 기록 1건 추가(히스토리). weight<=0 이면 no-op. */
export async function addWeightLog(userId: string, petId: string, weight: number, date?: string): Promise<void> {
  if (!weight || weight <= 0) return;
  try {
    await supabase.from('weight_logs').insert({
      user_id: userId,
      pet_id: petId,
      weight,
      measured_at: date ?? todayLocalISO(),
    });
  } catch {}
}

/** 오늘자 체중 기록을 upsert(있으면 갱신, 없으면 추가) — 프로필 무게 수정용(같은 날 중복 방지). */
export async function upsertTodayWeightLog(userId: string, petId: string, weight: number): Promise<void> {
  if (!weight || weight <= 0) return;
  const today = todayLocalISO();
  try {
    const { data } = await supabase
      .from('weight_logs')
      .select('id')
      .eq('pet_id', petId)
      .eq('measured_at', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      await supabase.from('weight_logs').update({ weight }).eq('id', (data as { id: string }).id);
    } else {
      await supabase.from('weight_logs').insert({ user_id: userId, pet_id: petId, weight, measured_at: today });
    }
  } catch {}
}

/** pets.weight 를 최신 weight_log 값으로 동기화(캐시). 백데이트/삭제도 안전하게 재계산. */
export async function syncPetWeightCache(petId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('weight_logs')
      .select('weight')
      .eq('pet_id', petId)
      .gt('weight', 0)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      await supabase.from('pets').update({ weight: Number((data as { weight: number }).weight) }).eq('id', petId);
    }
  } catch {}
}
