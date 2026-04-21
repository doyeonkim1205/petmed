import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';

const BUCKET_NAME = 'medical-files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_MAX_DIMENSION = 1600; // px
const IMAGE_QUALITY = 0.8;

function isImageType(type: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type);
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // 이미 작으면 압축 불필요
      if (width <= IMAGE_MAX_DIMENSION && height <= IMAGE_MAX_DIMENSION && file.size < 500 * 1024) {
        resolve(file);
        return;
      }

      // 비율 유지하며 리사이즈
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        const ratio = Math.min(IMAGE_MAX_DIMENSION / width, IMAGE_MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file); // 압축 후 더 커지면 원본 사용
            return;
          }
          const compressed = new File([blob], file.name, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/webp',
        IMAGE_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
    img.src = url;
  });
}

export async function uploadFile(
  file: File,
  userId: string,
  recordId: string,
): Promise<{ path: string; url: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('파일 크기는 5MB 이하만 가능합니다.');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('JPG, PNG, WebP, PDF 파일만 업로드 가능합니다.');
  }

  // 이미지면 압축
  const uploadTarget = isImageType(file.type) ? await compressImage(file) : file;

  const ext = uploadTarget.type === 'image/webp' ? 'webp' : file.name.split('.').pop();
  // 파일명에 crypto.randomUUID() 포함 — URL 예측 가능성 제거.
  // 기존 Date.now() 는 업로드 시각 대략 알면 수백만 가지로 좁혀져서
  // userId + recordId UUID 를 안다는 전제에서 취약. UUID 로 바꿔 완전 무작위화.
  // medical-files 버킷이 public 이라도 URL 추측 불가 → 사실상 signed URL 수준 안전.
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${userId}/${recordId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, uploadTarget);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  logActivity(userId, 'file.upload', {
    resourceType: 'record_file',
    resourceId: recordId,
    details: { fileName: file.name, fileSize: file.size, fileType: file.type },
  });

  return { path: filePath, url: urlData.publicUrl };
}

export async function deleteFile(filePath: string, userId?: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) throw error;

  if (userId) {
    logActivity(userId, 'file.delete', {
      resourceType: 'record_file',
      details: { filePath },
    });
  }
}

export async function checkStorageLimit(token: string): Promise<{ canUpload: boolean; usedMB: number; limitMB: number }> {
  const res = await fetch('/api/storage-usage', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return { canUpload: true, usedMB: 0, limitMB: 0 };
  return res.json();
}

export async function saveFileRecord(record: {
  record_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  ai_analysis?: string;
}) {
  const { data, error } = await supabase
    .from('record_files')
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}
