'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dog, Cat } from 'lucide-react';
import { TextField } from '@/components/TextField';
import { DatePicker } from '@/components/ui/DatePicker';
import { NumberPad } from '@/components/ui/NumberPad';
import type { PetFormState } from '@/lib/petForm';
import { useMarketRegion } from '@/hooks/useMarketRegion';
import { weightUnit } from '@/lib/region';

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
  const t = useTranslations();
  const wUnit = weightUnit(useMarketRegion()); // 체중 단위 (KR=kg, US=lb) — 표시/입력 접미
  // 터치 기기에선 OS 키보드 대신 내장 숫자 패드 (다른 체중 입력칸과 통일)
  const [isTouch, setIsTouch] = useState(false);
  const [showWeightPad, setShowWeightPad] = useState(false);
  useEffect(() => {
    setIsTouch(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

  return (
    <div className="space-y-3">
      {/* AI 증상 분석에 펫 컨텍스트가 자동 주입돼 정확도가 좌우됨 →
         등록 시 정보 입력 의욕을 부드럽게 유도. 모든 필드는 여전히 선택. */}
      {showHint && (
        <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-line">
          {t('petForm.hint')}
        </p>
      )}

      {/* 이름 (필수) */}
      <TextField
        placeholder={t('petForm.name')}
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
          <Dog size={14} /> {t('pets.type.dog')}
        </button>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, type: 'cat' }))}
          className={`flex-1 h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
            form.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
          }`}
        >
          <Cat size={14} /> {t('pets.type.cat')}
        </button>
      </div>

      {/* 품종 */}
      <TextField
        placeholder={t('petForm.breed')}
        value={form.breed}
        onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
        maxLength={25}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />

      {/* 생년월일 — max=오늘 (오늘 포함 이전만 허용).
          ⚠️ toISOString() 은 UTC 라 한국 시간 새벽엔 max 가 어제로 보임.
          getFullYear/getMonth/getDate 로 로컬 ISO 생성. */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">{t('petForm.birthDate')}</label>
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
        <label className="text-[11px] text-gray-400 mb-1 block">{t('petForm.sex')}</label>
        <div className="flex gap-1.5">
          {(['', 'male', 'female'] as const).map(s => {
            const labelMap: Record<'' | 'male' | 'female', string> = { '': t('petForm.unknown'), male: t('petForm.male'), female: t('petForm.female') };
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
        <label className="text-[11px] text-gray-400 mb-1 block">{t('petForm.neuter')}</label>
        <div className="flex gap-1.5">
          {(['', 'yes', 'no'] as const).map(v => {
            const labelMap: Record<'' | 'yes' | 'no', string> = { '': t('petForm.unknown'), yes: t('petForm.neuterYes'), no: t('petForm.neuterNo') };
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
        <label className="text-[11px] text-gray-400 mb-1 block">{t('petForm.weight')}</label>
        <div className="relative">
          <TextField
            inputMode={isTouch ? 'none' : 'decimal'}
            placeholder={t('petForm.weightPlaceholder')}
            value={form.weight}
            onChange={e => {
              const v = e.target.value;
              if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) {
                setForm(f => ({ ...f, weight: v }));
              }
            }}
            readOnly={isTouch}
            onClick={() => { if (isTouch) setShowWeightPad(true); }}
            maxLength={6}
            className={`w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm ${isTouch ? 'cursor-pointer' : ''}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
            {wUnit}
          </span>
        </div>
        {showWeightPad && (
          <NumberPad
            value={form.weight}
            onChange={(v) => setForm(f => ({ ...f, weight: v }))}
            decimal
            maxIntDigits={3}
            maxDecimals={2}
            label={t('petForm.weightLabel')}
            suffix={wUnit}
            onClose={() => setShowWeightPad(false)}
          />
        )}
      </div>

      {/* 만성질환 — 쉼표 구분 자유 입력 (100자 한도) */}
      <div>
        <label className="text-[11px] text-gray-400 mb-1 block">{t('petForm.chronic')}</label>
        <TextField
          placeholder={t('petForm.chronicPlaceholder')}
          value={form.chronic_conditions}
          onChange={e => setForm(f => ({ ...f, chronic_conditions: e.target.value }))}
          maxLength={100}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>
    </div>
  );
}
