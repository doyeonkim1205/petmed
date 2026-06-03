'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  placeholder?: string;
  // 첨부 저장 공간 — 부모가 /api/storage-usage 결과 전달. 없으면 표시 X.
  storageUsage?: { usedMB: number; limitMB: number } | null;
}

function formatStorageMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)}GB`;
  return `${Math.round(mb)}MB`;
}

export function FileUploader({ files, onFilesChange, maxFiles = 3, placeholder = '여기를 눌러 사진이나 파일을 올려주세요', storageUsage }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = Array.from(newFiles).filter((f) => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(f.type)) return false;
      if (f.size > 5 * 1024 * 1024) return false;
      return true;
    });

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
      {atLimit ? (
        // 한도 도달: 업로드 영역 대신 안내 문구만 (파일 리스트는 아래 유지)
        <p className="text-xs text-gray-400 text-center py-2">
          최대 {maxFiles}개 파일까지 첨부 가능합니다
        </p>
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
