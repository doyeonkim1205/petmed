import type { Pet } from '@/lib/supabase';

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

/** DB Pet → 폼 상태 (편집 모드 진입 시). */
export function petToForm(pet: Pet): PetFormState {
  return {
    name: pet.name,
    type: pet.type,
    breed: pet.breed || '',
    birth_date: pet.birth_date || '',
    sex: pet.sex || '',
    neutered: pet.neutered === true ? 'yes' : pet.neutered === false ? 'no' : '',
    weight: pet.weight != null ? String(pet.weight) : '',
    chronic_conditions: (pet.chronic_conditions || []).join(', '),
  };
}

/** 폼 상태 → DB payload (NULL/배열 변환). */
export function formToPayload(form: PetFormState) {
  const weightNum = form.weight.trim() ? parseFloat(form.weight.trim()) : null;
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
  return null;
}
