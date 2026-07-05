'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LabTestForm, LabFormInitial } from '@/components/records/LabTestForm';
import { useLabTests } from '@/hooks/useLabTests';

export default function EditLabPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations();
  const { getLabTest } = useLabTests();
  const [initial, setInitial] = useState<LabFormInitial | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getLabTest(id).then((t) => {
      if (!t) { setNotFound(true); return; }
      setInitial({
        id: t.id,
        test_date: t.test_date,
        hospital_name: t.hospital_name ?? '',
        memo: t.memo ?? '',
        values: (t.lab_values ?? []).map((v) => ({ analyte_key: v.analyte_key, label: v.label, value_raw: v.value_raw, unit: v.unit ?? null, ref_low: v.ref_low ?? null, ref_high: v.ref_high ?? null, ref_text: v.ref_text ?? null })),
        files: t.lab_test_files ?? [],
        pet_id: t.pet_id,
      });
    });
  }, [id, getLabTest]);

  if (notFound) return (
    <div className="bg-white min-h-full flex flex-col items-center justify-center gap-2 py-20">
      <p className="text-sm text-gray-400">{t('lab.detail.notFound')}</p>
      <button onClick={() => router.replace('/records/labs')} className="text-sm text-blue-500">{t('lab.detail.toList')}</button>
    </div>
  );
  if (!initial) return <div className="bg-white min-h-full" />;
  // 상세에서 들어왔으면(back 대상 있음) 저장 후 back(). 직접 진입이면 replace 로 상세로.
  const backOnSave = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'detail';
  return <LabTestForm initial={initial} backOnSave={backOnSave} />;
}
