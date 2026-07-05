'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LabTestForm } from '@/components/records/LabTestForm';

function AddInner() {
  const petId = useSearchParams().get('pet') || '';
  return <LabTestForm petId={petId} />;
}

export default function AddLabPage() {
  return <Suspense fallback={<div className="bg-white min-h-full" />}><AddInner /></Suspense>;
}
