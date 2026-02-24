'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Stethoscope, AlertCircle, Building2, Plus, X, Bell, BellOff, ClipboardList, Pill, Paperclip } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useMedications } from '@/hooks/useMedications';
import { supabase, Pet, RecordType } from '@/lib/supabase';
import { FileUploader } from '@/components/records/FileUploader';
import { ColorPicker } from '@/components/records/ColorPicker';
import { uploadFile, saveFileRecord } from '@/services/fileUpload';

const recordTypes = [
  { id: 'symptom' as RecordType, label: '증상 기록', icon: AlertCircle, color: 'border-orange-300 bg-orange-50 text-orange-700' },
  { id: 'visit' as RecordType, label: '진료 기록', icon: Stethoscope, color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { id: 'hospitalization' as RecordType, label: '입퇴원', icon: Building2, color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
];

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
  name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  frequency: string;
  color: string;
  alarm_enabled: boolean;
  alarm_times: string[];
}

export default function RecordAddPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createRecord } = useHealthRecords();
  const { addMedication } = useMedications();
  const medEndRef = useRef<HTMLDivElement>(null);

  const [pets, setPets] = useState<Pet[]>([]);
  const [recordType, setRecordType] = useState<RecordType>('symptom');
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [symptomTime, setSymptomTime] = useState('');
  const [cost, setCost] = useState('');
  const [recordColor, setRecordColor] = useState('#3B82F6');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentColor, setNextAppointmentColor] = useState('#8B5CF6');
  const [dischargeDate, setDischargeDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [medications, setMedications] = useState<MedicationInput[]>([]);
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

  const addMedicationRow = () => {
    setMedications([
      ...medications,
      { name: '', dosage: '', start_date: visitDate, end_date: '', frequency: '1일 1회', color: '#3B82F6', alarm_enabled: true, alarm_times: ['09:00'] },
    ]);
    setTimeout(() => medEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  };

  const updateMedication = (index: number, field: keyof MedicationInput, value: string) => {
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
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) { router.push('/login'); return; }
    const showError = (msg: string) => {
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (!petId) { showError('반려동물을 선택해주세요.'); return; }
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
      const record = await createRecord({
        pet_id: petId,
        record_type: recordType,
        title: title.trim(),
        description: description.trim() || undefined,
        hospital_name: hospitalName.trim() || undefined,
        visit_date: visitDate,
        cost: cost ? Number(cost) : undefined,
        color: recordType === 'symptom' ? '#F97316' : recordType === 'hospitalization' ? '#10B981' : recordColor,
        discharge_date: recordType === 'hospitalization' && dischargeDate ? dischargeDate : undefined,
        next_appointment_date: nextAppointmentDate || undefined,
        next_appointment_color: nextAppointmentDate ? nextAppointmentColor : undefined,
        symptom_time: recordType === 'symptom' && symptomTime ? symptomTime : undefined,
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
            color: med.color,
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

  const showHospitalFields = recordType === 'visit' || recordType === 'hospitalization';

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">기록 추가</h1>
        <div className="w-10" />
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {/* ── 기본 정보 섹션 ── */}
        <div className="flex items-center gap-2 pt-2">
          <ClipboardList size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">기본 정보</h3>
        </div>

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

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {recordType === 'symptom' ? '증상명' : recordType === 'hospitalization' ? '입원 사유' : '제목'}
          </label>
          <input
            placeholder={recordType === 'symptom' ? '예: 구토, 설사' : recordType === 'hospitalization' ? '예: 슬개골 수술, 장염 치료' : '제목을 입력하세요'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Date */}
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

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            설명 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            placeholder="상세 내용을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none"
          />
        </div>

        {/* ── 진료 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Stethoscope size={16} className="text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">진료 정보</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                병원명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                placeholder="병원명을 입력하세요"
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
                placeholder="0"
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
                <ColorPicker label="예약일 캘린더 색상" value={nextAppointmentColor} onChange={setNextAppointmentColor} />
              )}
            </div>

            {/* Record Color */}
            <ColorPicker label="캘린더 표시 색상" value={recordColor} onChange={setRecordColor} />
          </>
        )}

        {/* ── 투약 정보 섹션 (진료/입퇴원만) ── */}
        {showHospitalFields && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              <Pill size={16} className="text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">투약 정보</h3>
              <button
                type="button"
                onClick={addMedicationRow}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium ml-auto"
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
                <input
                  placeholder="용량 (예: 1정)"
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
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
                          : 'bg-gray-100 text-gray-400'
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
                <ColorPicker
                  label="캘린더 색상"
                  value={med.color}
                  onChange={(c) => updateMedication(i, 'color', c)}
                />
              </div>
            ))}
            <div ref={medEndRef} />
          </div>
        )}

        {/* ── 첨부파일 섹션 ── */}
        <div className="flex items-center gap-2 pt-2">
          <Paperclip size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">첨부파일</h3>
        </div>

        <div className="space-y-2">
          <FileUploader
            files={files}
            onFilesChange={setFiles}
            maxFiles={3}
            placeholder={recordType === 'symptom' ? '증상 관련 사진이나 파일을 첨부하세요' : '진료 서류를 첨부하세요'}
          />
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
