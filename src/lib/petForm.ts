import type { Pet } from '@/lib/supabase';
import { kgToInputStr, displayWeightToKg, type MarketRegion } from '@/lib/region';

/**
 * 반려동물 등록·편집 폼의 공통 상태/변환 로직.
 *
 * 펫 등록 폼은 두 곳(프로필 모달, 기록장 첫 진입 화면)에서 쓰이는데,
 * 입력 항목이 어긋나지 않도록 타입·헬퍼·필드 UI(PetFormFields)를 공통화한다.
 *
 * AI 증상 분석 컨텍스트 필드(성별/중성화/체중/만성질환)는 모두 선택 입력 —
 * DB 에 NULL 로 들어가도 기존 기능 영향 0 (옛 펫은 그대로 유지).
 */
export type PetFormState = {
  name: string;
  type: 'dog' | 'cat';
  breed: string;
  birth_date: string;
  sex: '' | 'male' | 'female';
  neutered: '' | 'yes' | 'no';
  weight: string;                  // input 은 string, 저장 시 number 변환
  chronic_conditions: string;      // 쉼표 구분 입력, 저장 시 string[] 변환
};

export const EMPTY_PET_FORM: PetFormState = {
  name: '',
  type: 'dog',
  breed: '',
  birth_date: '',
  sex: '',
  neutered: '',
  weight: '',
  chronic_conditions: '',
};

/** DB Pet → 폼 상태 (편집 모드 진입 시). weight 는 지역 표시 단위로 변환(US=lb). */
export function petToForm(pet: Pet, region: MarketRegion = 'KR'): PetFormState {
  return {
    name: pet.name,
    type: pet.type,
    breed: pet.breed || '',
    birth_date: pet.birth_date || '',
    sex: pet.sex || '',
    neutered: pet.neutered === true ? 'yes' : pet.neutered === false ? 'no' : '',
    // 저장은 kg. KR 은 원값 그대로(반올림 X — 기존 동작 보존), US 만 lb 로 표시(소수 1자리).
    weight: kgToInputStr(pet.weight, region),
    chronic_conditions: (pet.chronic_conditions || []).join(', '),
  };
}

/** 폼 상태 → DB payload (NULL/배열 변환). weight 입력(지역 단위)을 kg 로 역변환해 저장. */
export function formToPayload(form: PetFormState, region: MarketRegion = 'KR') {
  const weightNum = form.weight.trim() ? displayWeightToKg(parseFloat(form.weight.trim()), region) : null;
  const conditions = form.chronic_conditions
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return {
    name: form.name.trim(),
    type: form.type,
    breed: form.breed.trim() || null,
    birth_date: form.birth_date || null,
    sex: form.sex || null,
    neutered: form.neutered === 'yes' ? true : form.neutered === 'no' ? false : null,
    weight: weightNum,
    chronic_conditions: conditions.length > 0 ? conditions : null,
  };
}

/** 폼 검증 — 통과 시 null, 실패 시 에러 메시지. */
export function validatePetForm(form: PetFormState): string | null {
  if (!form.name.trim()) return '이름을 입력해주세요';
  if (form.weight.trim()) {
    const w = parseFloat(form.weight.trim());
    if (isNaN(w) || w <= 0) return '체중은 양수로 입력해주세요 (예: 4.2)';
  }
  if (form.birth_date) {
    // input max 우회 (직접 타이핑 / 모바일 키보드 등) 방어용 이중 검증.
    // 시간대 안전: YYYY-MM-DD 문자열 사전순 비교 (사전순 = 날짜순).
    const now = new Date();
    const todayStr =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (form.birth_date > todayStr) {
      return '생년월일은 오늘 이전 날짜로 입력해주세요';
    }
  }
  return null;
}
