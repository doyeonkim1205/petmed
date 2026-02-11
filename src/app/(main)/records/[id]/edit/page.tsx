'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, HealthRecord, Medication } from '@/lib/supabase';

interface MedicationInput {
  id?: string;
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
  isNew?: boolean;
}

export default function RecordEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { getRecord, updateRecord } = useHealthRecords();
  const { addMedication, deleteMedication, getMedicationsByRecordId } = useMedications();

  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [cost, setCost] = useState('');
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [deletedMedIds, setDeletedMedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user]);

  const loadData = async () => {
    try {
      const [record, petData] = await Promise.all([
        getRecord(id),
        supabase.from('pets').select('*').eq('user_id', user!.id),
      ]);

      setPets(petData.data || []);
      setPetId(record.pet_id);
      setTitle(record.title);
      setDescription(record.description || '');
      setHospitalName(record.hospital_name || '');
      setVisitDate(record.visit_date.split('T')[0]);
      setCost(record.cost ? String(record.cost) : '');

      if (record.medications) {
        setMedications(
          record.medications.map((m) => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage || '',
            start_date: m.start_date,
            end_date: m.end_date || '',
            frequency: m.frequency,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading record:', error);
      router.push('/records');
    } finally {
      setLoading(false);
    }
  };

  const addMedicationRow = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', isNew: true },
    ]);
  };

  const updateMedicationField = (index: number, field: keyof MedicationInput, value: string) => {
    setMedications(medications.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const removeMedication = (index: number) => {
    const med = medications[index];
    if (med.id) setDeletedMedIds([...deletedMedIds, med.id]);
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }

    setSaving(true);
    setError('');

    try {
      await updateRecord(id, {
        pet_id: petId,
        title: title.trim(),
        description: description.trim() || undefined,
        hospital_name: hospitalName.trim() || undefined,
        visit_date: visitDate,
        cost: cost ? Number(cost) : undefined,
      } as any);

      // Delete removed medications
      for (const medId of deletedMedIds) {
        await deleteMedication(medId);
      }

      // Add new medications
      for (const med of medications) {
        if (med.isNew && med.name.trim()) {
          await addMedication({
            record_id: id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || undefined,
            frequency: med.frequency,
          });
        }
      }

      router.push(`/records/${id}`);
    } catch (err) {
      console.error('Error updating record:', err);
      setError('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">기록 수정</h1>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">반려동물</label>
          <select
            value={petId}
            onChange={(e) => setPetId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} ({pet.type === 'dog' ? '강아지' : '고양이'})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">날짜</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">병원명</label>
          <input
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">비용 (원)</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">투약 정보</label>
            <button
              type="button"
              onClick={addMedicationRow}
              className="flex items-center gap-1 text-sm text-blue-600 font-medium"
            >
              <Plus size={16} /> 약 추가
            </button>
          </div>
          {medications.map((med, i) => (
            <div key={med.id || i} className="p-3 bg-gray-50 rounded-xl space-y-2 relative">
              <button
                type="button"
                onClick={() => removeMedication(i)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
              >
                <X size={16} />
              </button>
              <input
                placeholder="약 이름"
                value={med.name}
                onChange={(e) => updateMedicationField(i, 'name', e.target.value)}
                disabled={!med.isNew && !!med.id}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="용량"
                  value={med.dosage}
                  onChange={(e) => updateMedicationField(i, 'dosage', e.target.value)}
                  disabled={!med.isNew && !!med.id}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                />
                <input
                  placeholder="빈도"
                  value={med.frequency}
                  onChange={(e) => updateMedicationField(i, 'frequency', e.target.value)}
                  disabled={!med.isNew && !!med.id}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">시작일</label>
                  <input
                    type="date"
                    value={med.start_date}
                    onChange={(e) => updateMedicationField(i, 'start_date', e.target.value)}
                    disabled={!med.isNew && !!med.id}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">종료일</label>
                  <input
                    type="date"
                    value={med.end_date}
                    onChange={(e) => updateMedicationField(i, 'end_date', e.target.value)}
                    disabled={!med.isNew && !!med.id}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
