'use client';

import { HealthRecord } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit, Building2, Pill, Paperclip, CalendarClock, LogOut } from 'lucide-react';

interface RecordCardProps {
  record: HealthRecord;
  onClick: () => void;
}

const typeConfig = {
  symptom: { icon: AlertCircle, label: '증상', color: 'bg-orange-100 text-orange-600' },
  visit: { icon: Stethoscope, label: '진료', color: 'bg-blue-100 text-blue-600' },
  hospitalization: { icon: Building2, label: '입퇴원', color: 'bg-emerald-100 text-emerald-600' },
  manual: { icon: FileEdit, label: '수동', color: 'bg-green-100 text-green-600' },
};

export function RecordCard({ record, onClick }: RecordCardProps) {
  const config = typeConfig[record.record_type] || typeConfig.manual;
  const Icon = config.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('ko-KR').format(cost) + '원';
  };

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
              {config.label}
            </span>
            {record.pets && (
              <span className="text-[11px] text-gray-400">{record.pets.name}</span>
            )}
            <span className="text-[11px] text-gray-300 ml-auto flex-shrink-0">
              {formatDate(record.visit_date)}
            </span>
          </div>
          <h3 className="font-semibold text-sm text-gray-800 line-clamp-1">{record.title}</h3>
          {record.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{record.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
            {record.hospital_name && (
              <span>{record.hospital_name}</span>
            )}
            {record.cost != null && record.cost > 0 && (
              <span className="font-medium text-gray-600">{formatCost(record.cost)}</span>
            )}
            {record.medications && record.medications.length > 0 && (
              <span className="flex items-center gap-1">
                <Pill size={12} />
                <span>
                  {record.medications.slice(0, 2).map(m => m.name).join(' · ')}
                  {record.medications.length > 2 && ` 외 ${record.medications.length - 2}개`}
                </span>
              </span>
            )}
            {record.record_files && record.record_files.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip size={12} /> {record.record_files.length}
              </span>
            )}
            {record.discharge_date && (
              <span className="flex items-center gap-1 text-emerald-600">
                <LogOut size={12} />
                <span>{new Date(record.discharge_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 퇴원</span>
              </span>
            )}
            {!record.discharge_date && record.record_type === 'hospitalization' && (
              <span className="text-orange-500 font-medium">입원 중</span>
            )}
            {record.next_appointment_date && (
              <span className="flex items-center gap-1">
                <CalendarClock size={12} />
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: record.next_appointment_color || '#8B5CF6' }}
                />
                <span>{new Date(record.next_appointment_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
