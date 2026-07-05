'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LabTestForm, LabFormInitial } from '@/components/records/LabTestForm';
import { useLabTests } from '@/hooks/useLabTests';

export default function EditLabPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
        values: (t.lab_values ?? []).map((v) => ({ analyte_key: v.analyte_key, label: v.label, value_raw: v.value_raw, unit: v.unit ?? null })),
      });
    });
  }, [id, getLabTest]);

  if (notFound) return (
    <div className="bg-white min-h-full flex flex-col items-center justify-center gap-2 py-20">
      <p className="text-sm text-gray-400">검사를 찾을 수 없어요.</p>
      <button onClick={() => router.replace('/records/labs')} className="text-sm text-blue-500">목록으로</button>
    </div>
  );
  if (!initial) return <div className="bg-white min-h-full" />;
  return <LabTestForm initial={initial} />;
}
