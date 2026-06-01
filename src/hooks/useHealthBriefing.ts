'use client';

import { useEffect, useState } from 'react';
import { supabase, type Pet } from '@/lib/supabase';
import {
  calculateAge,
  daysBetween,
  isBirthdayToday,
  pickHighlight,
  type Highlight,
  type PetAge,
} from '@/lib/healthBriefing';

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

function todayLocalISO(): string {
  // YYYY-MM-DD 로컬 (UTC 변환 X — 사용자 디바이스 자정 기준)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 홈 건강 브리핑용 데이터 hook.
 *
 * fetch 3개 병렬:
 *   1. pets (limit 10, 등록순)
 *   2. health_records.visit_date (펫별 max 계산용)
 *   3. health_records.next_appointment_date (future only)
 *
 * 클라이언트 가공: 펫마다 메트릭 계산 + 동적 강조 선정.
 */
export function useHealthBriefing(userId: string | undefined): UseHealthBriefingReturn {
  const [briefings, setBriefings] = useState<PetBriefing[]>([]);
  const [petsCount, setPetsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBriefings([]);
      setPetsCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
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
        if (cancelled) return;

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

        const result: PetBriefing[] = pets.map((pet) => {
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

        if (cancelled) return;
        setBriefings(result);
        setPetsCount(pets.length);
      } catch (e) {
        if (cancelled) return;
        // silent fail — 카드 자체가 안 뜨거나 빈 상태로 표시
        console.error('[useHealthBriefing] fetch error:', e);
        setBriefings([]);
        setPetsCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { briefings, petsCount, loading };
}
