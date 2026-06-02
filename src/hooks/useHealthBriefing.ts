'use client';

import useSWR from 'swr';
import { supabase, type Pet } from '@/lib/supabase';
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
  const [petsRes, recordsRes, apptsRes] = await Promise.all([
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(MAX_PETS),
    supabase
      .from('health_records')
      .select('pet_id, visit_date')
      .eq('user_id', userId),
    supabase
      .from('health_records')
      .select('pet_id, next_appointment_date')
      .eq('user_id', userId)
      .gte('next_appointment_date', today)
      .not('next_appointment_date', 'is', null),
  ]);

  const pets = (petsRes.data || []) as Pet[];
  const records = recordsRes.data || [];
  const appts = apptsRes.data || [];

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
    return {
      pet,
      age,
      isBirthday: birthdayToday,
      lastRecordDate,
      daysSinceLastRecord,
      nextAppointmentDate,
      daysUntilAppointment,
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

  return {
    briefings: data?.briefings ?? [],
    petsCount: data?.petsCount ?? 0,
    loading: isLoading,
  };
}
