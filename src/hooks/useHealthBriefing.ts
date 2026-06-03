'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { supabase, type Pet } from '@/lib/supabase';
import { readDefaultPetId } from '@/lib/petSort';
import {
  calculateAge,
  daysBetween,
  isBirthdayToday,
  pickHighlight,
  type Highlight,
  type PetAge,
} from '@/lib/healthBriefing';
import { healthBriefingKey } from '@/lib/swrCache';

const MAX_PETS = 10;

export interface PetBriefing {
  pet: Pet;
  age: PetAge | null;
  isBirthday: boolean;

  lastRecordDate: string | null;
  daysSinceLastRecord: number | null;  // null = 기록 0건

  nextAppointmentDate: string | null;
  daysUntilAppointment: number | null;

  // 최신 체중 — weight_logs 우선, 그 다음 health_records.weight, 그 다음 펫 등록 시 weight.
  // 셋 다 없으면 null (홈 배너에 미표시).
  latestWeight: number | null;

  highlight: Highlight;
}

interface UseHealthBriefingReturn {
  briefings: PetBriefing[];
  petsCount: number;   // 0 → 환영 카드 분기용
  loading: boolean;
}

interface BriefingPayload {
  briefings: PetBriefing[];
  petsCount: number;
}

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 홈 건강 브리핑 데이터를 한 번에 fetch + 클라이언트 가공.
 * SWR fetcher 로 사용 — 순수 비동기 함수.
 */
async function fetchBriefings(userId: string): Promise<BriefingPayload> {
  const today = todayLocalISO();
  // records 의 weight 도 같이 가져오기 위해 select 컬럼 확장. weight_logs 는 별도 쿼리.
  const [petsRes, recordsRes, apptsRes, weightLogsRes] = await Promise.all([
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(MAX_PETS),
    supabase
      .from('health_records')
      .select('pet_id, visit_date, weight')
      .eq('user_id', userId),
    supabase
      .from('health_records')
      .select('pet_id, next_appointment_date')
      .eq('user_id', userId)
      .gte('next_appointment_date', today)
      .not('next_appointment_date', 'is', null),
    supabase
      .from('weight_logs')
      .select('pet_id, weight, measured_at')
      .eq('user_id', userId),
  ]);

  const pets = (petsRes.data || []) as Pet[];
  const records = recordsRes.data || [];
  const appts = apptsRes.data || [];
  const weightLogs = weightLogsRes.data || [];

  // 펫별 마지막 기록 일자
  const lastByPet = new Map<string, string>();
  for (const r of records) {
    const cur = lastByPet.get(r.pet_id);
    const dateOnly = (r.visit_date as string).split('T')[0];
    if (!cur || dateOnly > cur) lastByPet.set(r.pet_id, dateOnly);
  }

  // 펫별 다음 예약 (가장 가까운 future)
  const nextApptByPet = new Map<string, string>();
  for (const a of appts) {
    const dateOnly = (a.next_appointment_date as string).split('T')[0];
    const cur = nextApptByPet.get(a.pet_id);
    if (!cur || dateOnly < cur) nextApptByPet.set(a.pet_id, dateOnly);
  }

  // 펫별 weight_logs 최신 — measured_at desc 기준. 동률이면 그 중 한 값 (정렬 없이도 OK).
  const latestWeightLogByPet = new Map<string, { weight: number; measuredAt: string }>();
  for (const w of weightLogs) {
    const weight = (w as { weight?: number | null }).weight;
    if (weight === null || weight === undefined) continue;
    const cur = latestWeightLogByPet.get(w.pet_id);
    const measuredAt = (w.measured_at as string).split('T')[0];
    if (!cur || measuredAt > cur.measuredAt) {
      latestWeightLogByPet.set(w.pet_id, { weight: Number(weight), measuredAt });
    }
  }

  // 펫별 records.weight 최신 — visit_date desc 기준. weight 가 null 인 행은 skip.
  const latestRecordWeightByPet = new Map<string, { weight: number; visitDate: string }>();
  for (const r of records) {
    const weight = (r as { weight?: number | null }).weight;
    if (weight === null || weight === undefined) continue;
    const cur = latestRecordWeightByPet.get(r.pet_id);
    const visitDate = (r.visit_date as string).split('T')[0];
    if (!cur || visitDate > cur.visitDate) {
      latestRecordWeightByPet.set(r.pet_id, { weight: Number(weight), visitDate });
    }
  }

  const briefings: PetBriefing[] = pets.map((pet) => {
    const age = calculateAge(pet.birth_date);
    const birthdayToday = isBirthdayToday(pet.birth_date);
    const lastRecordDate = lastByPet.get(pet.id) || null;
    const daysSinceLastRecord =
      lastRecordDate !== null ? daysBetween(lastRecordDate, today) : null;
    const nextAppointmentDate = nextApptByPet.get(pet.id) || null;
    const daysUntilAppointment =
      nextAppointmentDate !== null ? daysBetween(today, nextAppointmentDate) : null;
    const highlight = pickHighlight({
      isBirthday: birthdayToday,
      daysUntilAppointment,
      daysSinceLastRecord,
    });

    // latestWeight 결정 — weight_logs > records.weight > pet.weight 우선순위.
    // weight_logs 와 records.weight 둘 다 있으면 더 최근 날짜 우선.
    const logEntry = latestWeightLogByPet.get(pet.id);
    const recEntry = latestRecordWeightByPet.get(pet.id);
    let latestWeight: number | null = null;
    if (logEntry && recEntry) {
      latestWeight = logEntry.measuredAt >= recEntry.visitDate ? logEntry.weight : recEntry.weight;
    } else if (logEntry) {
      latestWeight = logEntry.weight;
    } else if (recEntry) {
      latestWeight = recEntry.weight;
    } else if (pet.weight && pet.weight > 0) {
      latestWeight = pet.weight;
    }

    return {
      pet,
      age,
      isBirthday: birthdayToday,
      lastRecordDate,
      daysSinceLastRecord,
      nextAppointmentDate,
      daysUntilAppointment,
      latestWeight,
      highlight,
    };
  });

  return { briefings, petsCount: pets.length };
}

/**
 * 홈 건강 브리핑용 데이터 hook (SWR 기반).
 *
 * 캐싱 동작:
 *   - 같은 userId → 메모리 캐시 hit, 즉시 반환 + 백그라운드 revalidate
 *   - revalidateOnFocus: 탭/앱 활성화 시 자동 재 fetch (무효화 누락 안전망)
 *   - focusThrottleInterval 30s: PWA 사용자 자주 focus switch 해도 부하 제어
 *   - dedupingInterval 2s: 빠른 연속 요청 중복 차단
 *
 * 무효화 trigger: 펫/기록 mutation 시점에 invalidateHealthBriefing(userId) 호출.
 */
export function useHealthBriefing(userId: string | undefined): UseHealthBriefingReturn {
  const key = healthBriefingKey(userId);
  const { data, isLoading } = useSWR<BriefingPayload>(
    key,
    () => fetchBriefings(userId!),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      focusThrottleInterval: 30000,
      // network 실패 / RLS 에러 시 silent fallback (빈 데이터)
      onError: (e) => {
        console.error('[useHealthBriefing] fetch error:', e);
      },
    },
  );

  // 기본 반려동물(localStorage 'defaultPetId') 을 항상 맨 위로 정렬.
  const sortedBriefings = useMemo(() => {
    const list = data?.briefings ?? [];
    const defaultId = readDefaultPetId();
    if (!defaultId || list.length <= 1) return list;
    return [...list].sort((a, b) => {
      if (a.pet.id === defaultId && b.pet.id !== defaultId) return -1;
      if (b.pet.id === defaultId && a.pet.id !== defaultId) return 1;
      return 0;
    });
  }, [data]);

  return {
    briefings: sortedBriefings,
    petsCount: data?.petsCount ?? 0,
    loading: isLoading,
  };
}
