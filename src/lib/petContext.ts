/**
 * 펫 컨텍스트 빌더 — AI 증상 분석에 펫의 의료적 배경 정보를 주입하기 위한
 * 데이터 fetch + 프롬프트 문자열 변환 헬퍼.
 *
 * 사용처:
 *   - /api/symptom-analysis (텍스트 증상 분석)
 *   - 향후 /api/symptom-analysis-image (사진 분석) 에서도 동일하게 재사용
 *
 * 데이터 출처:
 *   - pets             : 기본 정보 (종, 품종, 나이, 성별, 중성화, 체중, 만성질환)
 *   - medications      : 현재 복용 중인 약 (start_date ≤ today 이고 end_date 미경과)
 *                        record_id → health_records 통해 pet_id 매칭
 *   - health_records   : 최근 3개월 진료성 record (visit / hospitalization / symptom)
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

export interface PetMedication {
  name: string;
  dosage: string | null;
  frequency: string;
}

export interface PetRecentRecord {
  visit_date: string;
  title: string;
  record_type: string;
  /** 진료 본문 — 최근 3건만 포함 + 100자 cap (token / 개인정보 균형) */
  description?: string;
}

export interface PetContext {
  pet: Pet;
  medications: PetMedication[];
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
 * 펫 ID 와 user_id 로 펫 + 약 + 최근 진료 한꺼번에 fetch.
 * - 다른 유저의 펫 ID 면 null 반환 (silent fail — 보안 핵심)
 * - 펫만 있고 약/기록 없어도 정상 반환 (빈 배열)
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

  const todayISO = new Date().toISOString().split('T')[0];

  // 2. 복용 중인 약 — record_id → health_records 통해 pet_id 매칭 (JOIN).
  //    !inner 로 INNER JOIN 강제 (health_records 없는 medications 는 제외).
  const { data: medRows } = await supabaseAdmin
    .from('medications')
    .select('name, dosage, frequency, start_date, end_date, health_records!inner(pet_id)')
    .eq('user_id', userId)
    .lte('start_date', todayISO)
    .or(`end_date.gte.${todayISO},end_date.is.null`);

  const medications: PetMedication[] = [];
  for (const m of medRows || []) {
    // Supabase nested select 타입 한계로 health_records 가 array/object 둘 다 가능 → 양쪽 처리
    const hr = (m as unknown as { health_records: { pet_id: string } | { pet_id: string }[] }).health_records;
    const matchPetId = Array.isArray(hr) ? hr[0]?.pet_id : hr?.pet_id;
    if (matchPetId === petId) {
      medications.push({
        name: m.name,
        dosage: m.dosage ?? null,
        frequency: m.frequency,
      });
    }
  }

  // 3. 최근 3개월 진료 기록 — 진료성 record_type 만
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoISO = threeMonthsAgo.toISOString().split('T')[0];

  const { data: recordRows } = await supabaseAdmin
    .from('health_records')
    .select('visit_date, title, record_type, description')
    .eq('user_id', userId)
    .eq('pet_id', petId)
    .in('record_type', ['visit', 'hospitalization', 'symptom'])
    .gte('visit_date', threeMonthsAgoISO)
    .order('visit_date', { ascending: false })
    .limit(5);

  // description 은 최근 3건만 포함 + 100자 cap.
  // 이유:
  //  - 제목만 보면 정보 부실 (유저가 "검사" 같이 대충 적는 경우 많음)
  //  - description 까지 풍부히 넣으면 token 폭증 + 개인정보 노출 ↑
  //  - 최근 3건 (가장 최근 진료 위주) + 100자 cap 으로 핵심 정보 + 비용 균형.
  const recentRecords: PetRecentRecord[] = (recordRows || []).map((r, idx) => ({
    visit_date: r.visit_date,
    title: r.title,
    record_type: r.record_type,
    ...(idx < 3 && r.description
      ? { description: r.description.length > 100 ? r.description.slice(0, 100) + '…' : r.description }
      : {}),
  }));

  return { pet, medications, recentRecords };
}

/**
 * 펫 컨텍스트를 자연어 프롬프트 텍스트로 변환.
 * NULL/빈 필드는 자동 생략 — "성별: 미입력" 같은 placeholder 안 넣음.
 * 펫 자체 없으면 빈 문자열 (호출 측에서 그대로 합칠 수 있음).
 */
export function buildPetContextPrompt(ctx: PetContext | null): string {
  if (!ctx) return '';
  const { pet, medications, recentRecords } = ctx;

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
      // description 있으면 제목 + 짧은 본문 (최근 3건만 — fetchPetContext 에서 cap 처리됨).
      // 형태: "2026-04-06: 구토 증상 — 사료 30분 후, 노란 거품"
      const body = r.description ? ` — ${r.description}` : '';
      lines.push(`- ${r.visit_date}: ${r.title}${body}`);
    }
  }

  if (medications.length > 0) {
    lines.push('');
    lines.push('[복용 중인 약]');
    for (const m of medications) {
      const dosageStr = m.dosage ? ` ${m.dosage}` : '';
      lines.push(`- ${m.name}${dosageStr} (${m.frequency})`);
    }
  }

  return lines.join('\n');
}
