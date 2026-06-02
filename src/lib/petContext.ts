/**
 * 펫 컨텍스트 빌더 — AI 증상/사진 분석에 펫의 의료적 배경 정보를 주입하기 위한
 * 데이터 fetch + 프롬프트 문자열 변환 헬퍼.
 *
 * 사용처:
 *   - /api/symptom-analysis (텍스트 증상 분석)
 *   - /api/symptom-analysis-image (사진 분석)
 *
 * 데이터 출처:
 *   - pets             : 기본 정보 (종, 품종, 나이, 성별, 중성화, 체중, 만성질환)
 *   - health_records   : 최근 3개월 진료성 record (visit / hospitalization 만)
 *                        - 사용자가 자유롭게 적는 symptom 기록은 노이즈가 많아 제외
 *                        - 동물병원 방문 기반 사건만 의료적 ground truth 로 신뢰
 *                        - 최근 3건 + 모든 record 에 description (200자 cap) 포함
 *
 *   ✗ medications      : 사용자 입력 이름이 모호하면("약" 만 적음 등) AI 가
 *                        오히려 잘못 추측할 위험 → 컨텍스트에서 제외.
 *
 * 보안:
 *   - 호출 측이 반드시 user_id 검증 후 호출해야 함 (이 헬퍼는 user 검증 X)
 *   - 일반적으로 호출 흐름: verifyAuth → pet user_id 검증 → fetchPetContext
 *
 * NULL 처리:
 *   - 미입력 필드는 프롬프트에서 생략 (없는 척하지 말고 그냥 빼는 게 자연스러움)
 *   - 펫 자체가 없으면 (petId=null 또는 다른 유저 펫) buildPetContextPrompt 가
 *     빈 문자열 반환 — 호출 측에서 그대로 사용 가능.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pet } from './supabase';

export interface PetRecentRecord {
  visit_date: string;
  title: string;
  record_type: string;
  /** 진료 본문 — 200자 cap (token / 개인정보 균형) */
  description?: string;
}

export interface PetContext {
  pet: Pet;
  recentRecords: PetRecentRecord[];
}

/** 생년월일 → "12살" 자연어 변환. NULL/잘못된 형식이면 빈 문자열. */
export function formatAge(birthDate: string | null | undefined): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years < 0 ? '' : `${years}살`;
}

/**
 * 펫 ID 와 user_id 로 펫 + 최근 진료(visit/hospitalization) 한꺼번에 fetch.
 * - 다른 유저의 펫 ID 면 null 반환 (silent fail — 보안 핵심)
 * - 펫만 있고 기록 없어도 정상 반환 (빈 배열)
 */
export async function fetchPetContext(
  supabaseAdmin: SupabaseClient,
  userId: string,
  petId: string,
): Promise<PetContext | null> {
  // 1. 펫 정보 — user_id 까지 매칭 (다른 유저 펫 차단)
  const { data: pet } = await supabaseAdmin
    .from('pets')
    .select('*')
    .eq('id', petId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!pet) return null;

  // 2. 최근 3개월 진료 기록 — visit / hospitalization 만.
  //    symptom (사용자 자유 입력 증상 메모) 은 노이즈 가능성 ↑ 라 제외.
  //    daily (일상) 도 의료적 의미 약해 제외 (애초에 in 절에 없음).
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoISO = threeMonthsAgo.toISOString().split('T')[0];

  const { data: recordRows } = await supabaseAdmin
    .from('health_records')
    .select('visit_date, title, record_type, description')
    .eq('user_id', userId)
    .eq('pet_id', petId)
    .in('record_type', ['visit', 'hospitalization'])
    .gte('visit_date', threeMonthsAgoISO)
    .order('visit_date', { ascending: false })
    .limit(3);

  // 모든 fetched record 에 description 포함 (일관). cap 200 자.
  // 이전엔 limit(5) + 최근 3건만 description 이라 4~5번째 record 가 title 만 잡혀
  // AI 가 어떤 진료인지 추측 어려웠음. 3건 모두 풍부히 → token / 정보 균형.
  const recentRecords: PetRecentRecord[] = (recordRows || []).map((r) => ({
    visit_date: r.visit_date,
    title: r.title,
    record_type: r.record_type,
    ...(r.description
      ? { description: r.description.length > 200 ? r.description.slice(0, 200) + '…' : r.description }
      : {}),
  }));

  return { pet, recentRecords };
}

/**
 * 펫 컨텍스트를 자연어 프롬프트 텍스트로 변환.
 * NULL/빈 필드는 자동 생략 — "성별: 미입력" 같은 placeholder 안 넣음.
 * 펫 자체 없으면 빈 문자열 (호출 측에서 그대로 합칠 수 있음).
 */
export function buildPetContextPrompt(ctx: PetContext | null): string {
  if (!ctx) return '';
  const { pet, recentRecords } = ctx;

  const lines: string[] = ['[환자 정보]'];

  lines.push(`- 이름: ${pet.name}`);

  const speciesLabel = pet.type === 'dog' ? '강아지' : '고양이';
  const speciesAndBreed = pet.breed ? `${speciesLabel} (${pet.breed})` : speciesLabel;
  lines.push(`- 종/품종: ${speciesAndBreed}`);

  const age = formatAge(pet.birth_date);
  if (age) lines.push(`- 나이: ${age} (${pet.birth_date} 출생)`);

  // 성별 + 중성화 한 줄로 합침 (둘 다 NULL 이면 줄 생략)
  if (pet.sex || pet.neutered != null) {
    const sexLabel = pet.sex === 'male' ? '수컷' : pet.sex === 'female' ? '암컷' : '';
    const neuterLabel =
      pet.neutered === true ? '중성화 완료'
      : pet.neutered === false ? '중성화 안 함'
      : '';
    const combined = [sexLabel, neuterLabel].filter(Boolean).join(' · ');
    if (combined) lines.push(`- 성별: ${combined}`);
  }

  if (pet.weight != null) lines.push(`- 체중: ${pet.weight}kg`);

  if (pet.chronic_conditions && pet.chronic_conditions.length > 0) {
    lines.push(`- 만성질환: ${pet.chronic_conditions.join(', ')}`);
  }

  if (recentRecords.length > 0) {
    lines.push('');
    lines.push('[최근 3개월 진료]');
    for (const r of recentRecords) {
      const body = r.description ? ` — ${r.description}` : '';
      lines.push(`- ${r.visit_date}: ${r.title}${body}`);
    }
  }

  return lines.join('\n');
}
