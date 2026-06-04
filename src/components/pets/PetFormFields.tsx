'use client';

import { Dog, Cat } from 'lucide-react';
import { TextField } from '@/components/TextField';
import { DatePicker } from '@/components/ui/DatePicker';
import type { PetFormState } from '@/lib/petForm';

/**
 * 반려동물 등록·편집 폼의 입력 필드 그룹 (공통 컴포넌트).
 *
 * 프로필 모달과 기록장 첫 진입 화면 양쪽에서 동일하게 사용 →
 * 입력 항목이 어긋나지 않도록 단일 소스로 관리.
 *
 * 모든 항목은 선택 입력(이름 제외). 외곽 컨테이너(간격/제목/버튼)는
 * 호출 측에서 감싸고, 여기서는 필드 묶음만 렌더한다.
 */
export function PetFormFields({
  form,
  setForm,
  showHint = true,
}: {
  form: PetFormState;
  setForm: React.Dispatch<React.SetStateAction<PetFormState>>;
  showHint?: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* AI 증상 분석에 펫 컨텍스트가 자동 주입돼 정확도가 좌우됨 →
         등록 시 정보 입력 의욕을 부드럽게 유도. 모든 필드는 여전히 선택. */}
      {showHint && (
        <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
          💡 정보를 자세히 입력할수록 AI 증상 분석이 더 정확해져요
        </p>
      )}

      {/* 이름 (필수) */}
      <TextField
        placeholder="이름"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        maxLength={12}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />

      {/* 종 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, type: 'dog' }))}
          className={`flex-1 h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
            form.type === 'dog' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
          }`}
        >
          <Dog size={14} /> 강아지
        </button>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, type: 'cat' }))}
          className={`flex-1 h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
            form.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
          }`}
        >
          <Cat size={14} /> 고양이
        </button>
      </div>

      {/* 품종 */}
      <TextField
        placeholder="품종 (선택)"
        value={form.breed}
        onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
        maxLength={25}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />

      {/* 생년월일 — max=오늘 (오늘 포함 이전만 허용).
          ⚠️ toISOString() 은 UTC 라 한국 시간 새벽엔 max 가 어제로 보임.
          getFullYear/getMonth/getDate 로 로컬 ISO 생성. */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">생년월일 (선택)</label>
        <DatePicker
          value={form.birth_date}
          onChange={(v) => setForm(f => ({ ...f, birth_date: v }))}
          max={(() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })()}
          inputClassName="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
        />
      </div>

      {/* 성별 — 미선택 허용 */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">성별 (선택)</label>
        <div className="flex gap-1.5">
          {(['', 'male', 'female'] as const).map(s => {
            const labelMap: Record<'' | 'male' | 'female', string> = { '': '모름', male: '수컷', female: '암컷' };
            const active = form.sex === s;
            return (
              <button
                key={s || 'unknown'}
                type="button"
                onClick={() => setForm(f => ({ ...f, sex: s }))}
                className={`flex-1 h-9 rounded-xl border text-xs font-medium transition-colors ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                {labelMap[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 중성화 — 미선택 허용 */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">중성화 여부 (선택)</label>
        <div className="flex gap-1.5">
          {(['', 'yes', 'no'] as const).map(v => {
            const labelMap: Record<'' | 'yes' | 'no', string> = { '': '모름', yes: '했어요', no: '안 했어요' };
            const active = form.neutered === v;
            return (
              <button
                key={v || 'unknown'}
                type="button"
                onClick={() => setForm(f => ({ ...f, neutered: v }))}
                className={`flex-1 h-9 rounded-xl border text-xs font-medium transition-colors ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                {labelMap[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 체중 — 숫자 입력, 단위 'kg' 는 입력창 오른쪽에 표시.
         입력 정규식 (^\d{0,3}(\.\d{0,2})?$): 정수 최대 3자리 + 소수 최대 2자리.
         inputMode=decimal 로 모바일 숫자 키패드. type=number 미사용. */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">체중 (선택)</label>
        <div className="relative">
          <TextField
            inputMode="decimal"
            placeholder="예: 4.2"
            value={form.weight}
            onChange={e => {
              const v = e.target.value;
              if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) {
                setForm(f => ({ ...f, weight: v }));
              }
            }}
            maxLength={6}
            className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
            kg
          </span>
        </div>
      </div>

      {/* 만성질환 — 쉼표 구분 자유 입력 (100자 한도) */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">만성질환 (선택, 쉼표로 구분)</label>
        <TextField
          placeholder="예: 신부전, 관절염"
          value={form.chronic_conditions}
          onChange={e => setForm(f => ({ ...f, chronic_conditions: e.target.value }))}
          maxLength={100}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>
    </div>
  );
}
