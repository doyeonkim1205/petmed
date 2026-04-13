'use client';

import { HealthRecord } from '@/lib/supabase';
import { Stethoscope, AlertCircle, FileEdit, Building2 } from 'lucide-react';

interface RecordCardProps {
  record: HealthRecord;
  onClick: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const typeConfig = {
  symptom: { icon: AlertCircle, label: '증상', color: 'bg-orange-100 text-orange-600' },
  visit: { icon: Stethoscope, label: '진료', color: 'bg-blue-100 text-blue-600' },
  hospitalization: { icon: Building2, label: '입퇴원', color: 'bg-emerald-100 text-emerald-600' },
  manual: { icon: FileEdit, label: '수동', color: 'bg-green-100 text-green-600' },
};

export function RecordCard({ record, onClick, selectMode, selected, onSelect }: RecordCardProps) {
  const config = typeConfig[record.record_type] || typeConfig.manual;
  const Icon = config.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleClick = () => {
    if (selectMode && onSelect) {
      onSelect(record.id);
    } else {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-xl p-4 border cursor-pointer transition-colors ${
        selectMode && selected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-100 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {selectMode && (
          <div className="flex items-center justify-center flex-shrink-0 pt-1">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
              }`}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
        )}
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
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{record.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
