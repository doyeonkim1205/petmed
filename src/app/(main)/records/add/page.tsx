'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Stethoscope, AlertCircle, FileEdit, Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, RecordType } from '@/lib/supabase';
import { FileUploader } from '@/components/records/FileUploader';
import { FileAnalysisResult } from '@/components/records/FileAnalysisResult';
import { DocumentAnalysisResult } from '@/services/openai';
import { uploadFile, saveFileRecord } from '@/services/fileUpload';

const recordTypes = [
  { id: 'symptom' as RecordType, label: '증상 기록', icon: AlertCircle, color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { id: 'visit' as RecordType, label: '진료 기록', icon: Stethoscope, color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { id: 'manual' as RecordType, label: '직접 입력', icon: FileEdit, color: 'border-green-300 bg-green-50 text-green-700' },
];

interface MedicationInput {
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
}

export default function RecordAddPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createRecord } = useHealthRecords();
  const { addMedication } = useMedications();

  const [pets, setPets] = useState<Pet[]>([]);
  const [recordType, setRecordType] = useState<RecordType>('symptom');
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const petList = data || [];
        setPets(petList);
        if (petList.length > 0) setPetId(petList[0].id);
      });
  }, [user]);

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('AI 분석 실패');

      const result: DocumentAnalysisResult = await res.json();
      setAnalysisResult(result);
    } catch (err) {
      setError('AI 분석 중 오류가 발생했습니다. 직접 입력해주세요.');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyAnalysis = (result: DocumentAnalysisResult) => {
    if (result.hospital_name) setHospitalName(result.hospital_name);
    if (result.visit_date) setVisitDate(result.visit_date);
    if (result.cost != null) setCost(String(result.cost));
    if (result.diagnosis) setTitle(result.diagnosis);
    if (result.summary) setDescription(result.summary);
    if (result.medications.length > 0) {
      setMedications(
        result.medications.map((m) => ({
          name: m.name,
          dosage: m.dosage || '',
          start_date: visitDate,
          end_date: '',
          frequency: m.frequency || '1일 1회',
        }))
      );
    }
  };

  const addMedicationRow = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회' },
    ]);
  };

  const updateMedication = (index: number, field: keyof MedicationInput, value: string) => {
    setMedications(medications.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    if (!petId) { setError('반려동물을 선택해주세요.'); return; }
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }

    setSaving(true);
    setError('');

    try {
      const record = await createRecord({
        pet_id: petId,
        record_type: recordType,
        title: title.trim(),
        description: description.trim() || undefined,
        hospital_name: hospitalName.trim() || undefined,
        visit_date: visitDate,
        cost: cost ? Number(cost) : undefined,
        ai_summary: analysisResult?.summary || undefined,
      });

      // Upload files
      for (const file of files) {
        try {
          const { path } = await uploadFile(file, user.id, record.id);
          await saveFileRecord({
            record_id: record.id,
            user_id: user.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
            ai_analysis: analysisResult ? JSON.stringify(analysisResult) : undefined,
          });
        } catch (err) {
          console.error('File upload error:', err);
        }
      }

      // Add medications
      for (const med of medications) {
        if (!med.name.trim()) continue;
        try {
          await addMedication({
            record_id: record.id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || undefined,
            frequency: med.frequency,
          });
        } catch (err) {
          console.error('Medication add error:', err);
        }
      }

      router.push('/records');
    } catch (err) {
      console.error('Error creating record:', err);
      setError('기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const showHospitalFields = recordType === 'visit' || recordType === 'manual';
  const showFileUpload = recordType === 'visit';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">기록 추가</h1>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim() || !petId}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {/* Record Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">기록 유형</label>
          <div className="flex gap-2">
            {recordTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setRecordType(type.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    recordType === type.id ? type.color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pet Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">반려동물</label>
          <select
            value={petId}
            onChange={(e) => setPetId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            <option value="">선택해주세요</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} ({pet.type === 'dog' ? '강아지' : '고양이'})
              </option>
            ))}
          </select>
        </div>

        {/* File Upload (visit only) */}
        {showFileUpload && (
          <div className="space-y-2">
            <label className="text-sm font-medium">진료 서류 첨부</label>
            <FileUploader files={files} onFilesChange={setFiles} />
            {files.length > 0 && !analysisResult && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {analyzing ? (
                  <><Loader2 size={16} className="animate-spin" /> AI 분석 중...</>
                ) : (
                  <><Sparkles size={16} /> AI 분석하기</>
                )}
              </button>
            )}
            {analysisResult && (
              <FileAnalysisResult result={analysisResult} onApply={applyAnalysis} />
            )}
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : '제목'}
          </label>
          <input
            placeholder={recordType === 'symptom' ? '예: 구토, 설사' : '제목을 입력하세요'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '발생일' : '진료일'}
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">설명</label>
          <textarea
            placeholder="상세 내용을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
          />
        </div>

        {/* Hospital fields */}
        {showHospitalFields && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">병원명</label>
              <input
                placeholder="병원명을 입력하세요"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">비용 (원)</label>
              <input
                type="number"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </>
        )}

        {/* Medications */}
        {(recordType === 'visit' || recordType === 'manual') && (
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
              <div key={i} className="p-3 bg-gray-50 rounded-xl space-y-2 relative">
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
                  onChange={(e) => updateMedication(i, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="용량 (예: 1정)"
                    value={med.dosage}
                    onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  />
                  <input
                    placeholder="빈도 (예: 1일 2회)"
                    value={med.frequency}
                    onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">시작일</label>
                    <input
                      type="date"
                      value={med.start_date}
                      onChange={(e) => updateMedication(i, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">종료일</label>
                    <input
                      type="date"
                      value={med.end_date}
                      onChange={(e) => updateMedication(i, 'end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
