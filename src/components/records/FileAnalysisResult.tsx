'use client';

import { DocumentAnalysisResult } from '@/services/openai';
import { Sparkles, Check } from 'lucide-react';

interface FileAnalysisResultProps {
  result: DocumentAnalysisResult;
  onApply: (result: DocumentAnalysisResult) => void;
}

export function FileAnalysisResult({ result, onApply }: FileAnalysisResultProps) {
  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-blue-700 font-medium">
        <Sparkles size={18} />
        AI 분석 결과
      </div>

      <div className="space-y-2 text-sm">
        {result.hospital_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">병원명</span>
            <span className="font-medium">{result.hospital_name}</span>
          </div>
        )}
        {result.visit_date && (
          <div className="flex justify-between">
            <span className="text-gray-500">진료일</span>
            <span className="font-medium">{result.visit_date}</span>
          </div>
        )}
        {result.diagnosis && (
          <div className="flex justify-between">
            <span className="text-gray-500">진단</span>
            <span className="font-medium">{result.diagnosis}</span>
          </div>
        )}
        {result.cost != null && (
          <div className="flex justify-between">
            <span className="text-gray-500">비용</span>
            <span className="font-medium">{new Intl.NumberFormat('ko-KR').format(result.cost)}원</span>
          </div>
        )}
        {result.medications.length > 0 && (
          <div>
            <span className="text-gray-500">처방약</span>
            <div className="mt-1 space-y-1">
              {result.medications.map((med, i) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium">{med.name}</span>
                  {med.dosage && <span className="text-gray-500"> {med.dosage}</span>}
                  {med.frequency && <span className="text-gray-500"> / {med.frequency}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {result.summary && (
          <div>
            <span className="text-gray-500">요약</span>
            <p className="mt-1 text-gray-700">{result.summary}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onApply(result)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <Check size={16} />
        분석 결과 적용하기
      </button>
    </div>
  );
}
