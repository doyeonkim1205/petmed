'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Paperclip, Image as ImageIcon, FileText, Download, Trash2, Bell, BellOff, ClipboardList, Stethoscope, Pill } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { ColorPicker } from '@/components/records/ColorPicker';
import { FileUploader } from '@/components/records/FileUploader';
import { supabase, Pet, HealthRecord, Medication, RecordFile } from '@/lib/supabase';
import { uploadFile, saveFileRecord, deleteFile } from '@/services/fileUpload';

const frequencyOptions = [
  { value: '1일 1회', times: 1 },
  { value: '1일 2회', times: 2 },
  { value: '1일 3회', times: 3 },
];

const defaultAlarmTimes: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '21:00'],
};

interface MedicationInput {
  id?: string;
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
  color: string;
  alarm_enabled: boolean;
  alarm_times: string[];
  isNew?: boolean;
}

export default function RecordEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { getRecord, updateRecord } = useHealthRecords();
  const { addMedication, updateMedication: updateMed, deleteMedication, getMedicationsByRecordId } = useMedications();
  const medEndRef = useRef<HTMLDivElement>(null);

  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [symptomTime, setSymptomTime] = useState('');
  const [cost, setCost] = useState('');
  const [recordColor, setRecordColor] = useState('#3B82F6');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentColor, setNextAppointmentColor] = useState('#8B5CF6');
  const [recordType, setRecordType] = useState('');
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [deletedMedIds, setDeletedMedIds] = useState<string[]>([]);
  const [dischargeDate, setDischargeDate] = useState('');
  const [existingFiles, setExistingFiles] = useState<RecordFile[]>([]);
  const [deletedFileIds, setDeletedFileIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
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
      setRecordColor(record.color || '#3B82F6');
      setRecordType(record.record_type);
      setDischargeDate(record.discharge_date ? record.discharge_date.split('T')[0] : '');
      setNextAppointmentDate(record.next_appointment_date ? record.next_appointment_date.split('T')[0] : '');
      setNextAppointmentColor(record.next_appointment_color || '#8B5CF6');
      setSymptomTime(record.symptom_time || '');

      if (record.medications) {
        setMedications(
          record.medications.map((m: any) => {
            const opt = frequencyOptions.find(f => f.value === m.frequency);
            const times = m.alarm_times || (opt ? defaultAlarmTimes[opt.times] : ['09:00']);
            return {
              id: m.id,
              name: m.name,
              dosage: m.dosage || '',
              start_date: m.start_date,
              end_date: m.end_date || '',
              frequency: m.frequency,
              color: m.color || '#3B82F6',
              alarm_enabled: m.alarm_enabled !== false,
              alarm_times: times,
            };
          })
        );
      }

      if (record.record_files) {
        setExistingFiles(record.record_files);
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
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', color: '#3B82F6', alarm_enabled: true, alarm_times: ['09:00'], isNew: true },
    ]);
    setTimeout(() => medEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  };

  const updateMedicationField = (index: number, field: keyof MedicationInput, value: string) => {
    setMedications(medications.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const updateMedFrequency = (index: number, freq: string) => {
    const opt = frequencyOptions.find(f => f.value === freq);
    const times = opt ? defaultAlarmTimes[opt.times] : ['09:00'];
    setMedications(medications.map((m, i) => (i === index ? { ...m, frequency: freq, alarm_times: times } : m)));
  };

  const updateMedAlarmTime = (medIndex: number, timeIndex: number, value: string) => {
    setMedications(medications.map((m, i) => {
      if (i !== medIndex) return m;
      const newTimes = [...m.alarm_times];
      newTimes[timeIndex] = value;
      return { ...m, alarm_times: newTimes };
    }));
  };

  const toggleMedAlarm = (index: number) => {
    setMedications(medications.map((m, i) => (i === index ? { ...m, alarm_enabled: !m.alarm_enabled } : m)));
  };

  const removeMedication = (index: number) => {
    const med = medications[index];
    if (med.id) setDeletedMedIds([...deletedMedIds, med.id]);
    setMedications(medications.filter((_, i) => i !== index));
  };

  const removeExistingFile = (fileId: string) => {
    setDeletedFileIds([...deletedFileIds, fileId]);
    setExistingFiles(existingFiles.filter((f) => f.id !== fileId));
  };

  const activeFileCount = existingFiles.length + newFiles.length;
  const maxNewFiles = 3 - existingFiles.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const titleLabel = recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '제목';
    if (!title.trim()) { showError(`${titleLabel}을 입력해주세요.`); return; }
    if (dischargeDate && dischargeDate < visitDate) {
      showError('퇴원일은 입원일 이후여야 합니다.'); return;
    }
    if (nextAppointmentDate && nextAppointmentDate < visitDate) {
      showError('다음 예약일은 ' + (recordType === 'hospitalization' ? '입원일' : '진료일') + ' 이후여야 합니다.'); return;
    }
    const emptyNameMed = medications.find(m => !m.name.trim());
    if (emptyNameMed) {
      showError('약 이름을 입력해주세요.'); return;
    }
    const noEndMed = medications.find(m => m.name.trim() && !m.end_date);
    if (noEndMed) {
      showError(`투약 종료일을 선택해주세요. (${noEndMed.name})`); return;
    }
    const badMed = medications.find(m => m.end_date && m.end_date < m.start_date);
    if (badMed) {
      showError(`투약 종료일은 시작일 이후여야 합니다. (${badMed.name})`); return;
    }

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
        color: recordColor,
        discharge_date: dischargeDate || null,
        next_appointment_date: nextAppointmentDate || null,
        next_appointment_color: nextAppointmentDate ? nextAppointmentColor : null,
        symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : null,
      } as any);

      // Delete removed files
      for (const fileId of deletedFileIds) {
        try {
          const file = (await supabase.from('record_files').select('file_path').eq('id', fileId).single()).data;
          if (file) await deleteFile(file.file_path);
          await supabase.from('record_files').delete().eq('id', fileId);
        } catch (err) {
          console.error('File delete error:', err);
        }
      }

      // Upload new files
      for (const file of newFiles) {
        try {
          const { path } = await uploadFile(file, user.id, id);
          await saveFileRecord({
            record_id: id,
            user_id: user.id,
            file_name: file.name,
            file_path: path,
            file_type: file.type,
            file_size: file.size,
          });
        } catch (err) {
          console.error('File upload error:', err);
        }
      }

      // Delete removed medications
      for (const medId of deletedMedIds) {
        await deleteMedication(medId);
      }

      // Update existing / add new medications
      for (const med of medications) {
        if (med.isNew && med.name.trim()) {
          await addMedication({
            record_id: id,
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || undefined,
            frequency: med.frequency,
            color: med.color,
          });
        } else if (med.id && med.name.trim()) {
          await updateMed(med.id, {
            name: med.name.trim(),
            dosage: med.dosage.trim() || undefined,
            start_date: med.start_date,
            end_date: med.end_date || null,
            frequency: med.frequency,
            color: med.color,
          });
        }
      }

      router.replace(`/records/${id}`);
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
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 수정</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pb-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {/* ── 기본 정보 섹션 ── */}
        <div className="flex items-center gap-2 py-2 bg-blue-50 -mx-4 px-4">
          <ClipboardList size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">기본 정보</h3>
        </div>

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
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '제목'}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '발생일' : recordType === 'hospitalization' ? '입원일' : '진료일'}
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {(recordType === 'visit' || recordType === 'hospitalization') && (
            <ColorPicker label="캘린더 표시 색상" value={recordColor} onChange={setRecordColor} />
          )}
        </div>

        {/* Symptom Time (optional, symptom only) */}
        {recordType === 'symptom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              발생 시간 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="time"
              value={symptomTime}
              onChange={(e) => setSymptomTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {/* Description (증상/입퇴원은 기본정보에) */}
        {recordType !== 'visit' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              설명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
            />
          </div>
        )}

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <>
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">진료 정보</h3>
            </div>

            {/* Description (진료는 진료정보에) */}
            {recordType === 'visit' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  설명 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                병원명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                비용 (원) <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Discharge Date (hospitalization only) */}
            {recordType === 'hospitalization' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  퇴원일 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400">아직 입원 중이면 비워두세요</p>
              </div>
            )}

            {/* Next Appointment Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                다음 예약일 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="date"
                value={nextAppointmentDate}
                onChange={(e) => setNextAppointmentDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {nextAppointmentDate && (
                <div className="ml-3 pl-3 border-l-2 border-purple-200">
                  <ColorPicker label="예약일 색상" value={nextAppointmentColor} onChange={setNextAppointmentColor} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 투약 정보 섹션 ── */}
        {(recordType === 'visit' || recordType === 'hospitalization') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
              <Pill size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">투약 정보</h3>
              <button
                type="button"
                onClick={addMedicationRow}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium ml-auto"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
                <input
                  placeholder="용량 (예: 1정)"
                  value={med.dosage}
                  onChange={(e) => updateMedicationField(i, 'dosage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
                {/* Frequency selector */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">투약 빈도</label>
                  <div className="flex gap-1.5">
                    {frequencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateMedFrequency(i, opt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          med.frequency === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-500'
                        }`}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Alarm times */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">알림 시간</label>
                    <button
                      type="button"
                      onClick={() => toggleMedAlarm(i)}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                        med.alarm_enabled
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-blue-50 text-gray-400'
                      }`}
                    >
                      {med.alarm_enabled ? <Bell size={11} /> : <BellOff size={11} />}
                      {med.alarm_enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {med.alarm_enabled && (
                    <div className="flex gap-1.5">
                      {med.alarm_times.map((time, ti) => (
                        <div key={ti} className="flex-1">
                          <p className="text-[10px] text-gray-300 mb-0.5">{ti + 1}회차</p>
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => updateMedAlarmTime(i, ti, e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">시작일</label>
                    <input
                      type="date"
                      value={med.start_date}
                      onChange={(e) => updateMedicationField(i, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">종료일</label>
                    <input
                      type="date"
                      value={med.end_date}
                      onChange={(e) => updateMedicationField(i, 'end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    />
                  </div>
                </div>
                <ColorPicker
                  label="캘린더 색상"
                  value={med.color}
                  onChange={(c) => updateMedicationField(i, 'color', c)}
                />
              </div>
            ))}
            <div ref={medEndRef} />
          </div>
        )}

        {/* ── 첨부파일 섹션 ── */}
        <div className="flex items-center gap-2 mt-1 py-2 bg-blue-50 -mx-4 px-4">
          <Paperclip size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">첨부파일</h3>
        </div>

        <div className="space-y-3">
          {/* Existing files */}
          {existingFiles.length > 0 && (
            <div className="space-y-2">
              {existingFiles.map((file) => {
                const isImage = file.file_type?.startsWith('image/');
                const FileIcon = isImage ? ImageIcon : FileText;
                const { data: urlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path);
                const { data: dlData } = supabase.storage.from('medical-files').getPublicUrl(file.file_path, { download: file.file_name });

                return (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {isImage ? (
                      <img
                        src={urlData.publicUrl}
                        alt={file.file_name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <FileIcon size={20} className="text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400">{(file.file_size / 1024).toFixed(0)}KB</p>
                    </div>
                    <a
                      href={dlData.publicUrl}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="다운로드"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(file.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* New file upload */}
          {activeFileCount < 3 && (
            <FileUploader
              files={newFiles}
              onFilesChange={setNewFiles}
              maxFiles={maxNewFiles}
              placeholder={recordType === 'symptom' ? '증상 관련 사진이나 파일을 첨부하세요' : '진료 서류를 첨부하세요'}
            />
          )}
          {activeFileCount >= 3 && (
            <p className="text-xs text-gray-400 text-center">최대 3개 파일까지 첨부 가능합니다.</p>
          )}
        </div>
      </form>

      {/* Bottom Save Button */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 z-10">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
