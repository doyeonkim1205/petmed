'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  placeholder?: string;
  // 첨부 저장 공간 — 부모가 /api/storage-usage 결과 전달. 없으면 표시 X.
  storageUsage?: { usedMB: number; limitMB: number } | null;
  // 한도 도달 안내 종류:
  //  'free'  무료 일반첨부 → Plus 업셀 + 저장용량 안내
  //  'plus'  Plus 일반첨부 → 저장용량 안내만
  //  'none'  일상 '한 컷' 등 플랜 무관 1장 디자인 → 추가 안내 없음 (기본)
  atLimitUpsell?: 'free' | 'plus' | 'none';
}

function formatStorageMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)}GB`;
  return `${Math.round(mb)}MB`;
}

export function FileUploader({ files, onFilesChange, maxFiles = 3, placeholder = '여기를 눌러 사진이나 파일을 올려주세요', storageUsage, atLimitUpsell = 'none' }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  // 거부된 파일 안내 — 5초 후 자동 사라짐, 새 파일 선택 시 즉시 새 결과로 교체.
  const [rejectedFiles, setRejectedFiles] = useState<{ name: string; reason: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const rejected: { name: string; reason: string }[] = [];
    const validFiles: File[] = [];

    for (const f of Array.from(newFiles)) {
      if (!validTypes.includes(f.type)) {
        rejected.push({ name: f.name, reason: 'JPG, PNG, PDF 만 가능' });
        continue;
      }
      // 이미지는 업로드 시점에 자동 압축되므로 원본 크기 무관.
      // PDF 만 원본 5MB 검사 (PDF 는 압축 안 함).
      if (f.type === 'application/pdf' && f.size > 5 * 1024 * 1024) {
        const mb = (f.size / (1024 * 1024)).toFixed(1);
        rejected.push({ name: f.name, reason: `PDF 는 5MB 이하만 가능 (${mb}MB)` });
        continue;
      }
      validFiles.push(f);
    }

    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setRejectedFiles(rejected);
    if (rejected.length > 0) {
      errorTimerRef.current = setTimeout(() => setRejectedFiles([]), 5000);
    }

    const combined = [...files, ...validFiles].slice(0, maxFiles);
    onFilesChange(combined);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return FileText;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  const atLimit = files.length >= maxFiles;

  return (
    <div className="space-y-3">
      {rejectedFiles.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div className="leading-snug flex-1 min-w-0">
            {rejectedFiles.length === 1 ? (
              <>
                <p className="text-xs font-medium break-all">{rejectedFiles[0].name} 는 추가하지 못했어요</p>
                <p className="text-[11px] text-red-500 mt-0.5">{rejectedFiles[0].reason}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium">{rejectedFiles.length}개 파일이 추가되지 못했어요</p>
                <ul className="text-[11px] text-red-500 mt-0.5 list-disc list-inside space-y-0.5">
                  {rejectedFiles.map((r, i) => (
                    <li key={i} className="break-all">{r.name} — {r.reason}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      {atLimit ? (
        // 한도 도달: 업로드 영역 대신 안내 문구만 (파일 리스트는 아래 유지)
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">{maxFiles === 0 ? '첨부 한도에 도달했어요' : `최대 ${maxFiles}개 파일까지 첨부할 수 있어요`}</p>
          {atLimitUpsell === 'free' && (
            <p className="text-[11px] text-gray-400 mt-1">Plus는 최대 5개 파일과 약 20배 저장공간(1GB)을 지원해요</p>
          )}
          {atLimitUpsell !== 'none' && (
            <p className="text-[10px] text-gray-300 mt-0.5">저장 용량은 마이페이지 &gt; 앱 설정에서 확인할 수 있어요</p>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload className="mx-auto mb-2 text-gray-400" size={24} />
          <p className="text-sm text-gray-600">{placeholder}</p>
          <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, PDF · 최대 {maxFiles}개</p>
          {storageUsage && storageUsage.limitMB > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              남은 용량 <span className="font-medium text-gray-500">{formatStorageMB(Math.max(storageUsage.limitMB - storageUsage.usedMB, 0))} / {formatStorageMB(storageUsage.limitMB)}</span>
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon size={20} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
