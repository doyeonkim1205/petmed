import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';

const BUCKET_NAME = 'medical-files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — 압축 성공 케이스의 상한
const MAX_UNCOMPRESSED_SIZE = 30 * 1024 * 1024; // 30MB — 압축 실패 fallback 시 원본 상한 (Supabase Pro 파일당 50MB 보다 보수적)
const IMAGE_MAX_DIMENSION = 1600; // px
const IMAGE_QUALITY = 0.8;

function isImageType(type: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type);
}

// <img> 폴백 디코더 — createImageBitmap 이 fail 했을 때 시도.
function decodeViaImgTag(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img tag decode failed')); };
    img.src = url;
  });
}

// 압축 성공 = File 반환, 압축 fail = null (호출 측이 원본 사용)
async function compressImage(file: File): Promise<File | null> {
  // 디코딩 1차: createImageBitmap (modern API, 메모리 효율적)
  // 디코딩 2차: <img> 태그 (legacy fallback)
  // 둘 다 fail → null 반환 → 호출 측이 원본 그대로 업로드
  let source: ImageBitmap | HTMLImageElement | null = null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    source = bitmap;
  } catch (err1) {
    console.warn('createImageBitmap failed, trying <img>:', err1);
    try {
      source = await decodeViaImgTag(file);
    } catch (err2) {
      console.error('both decoders failed:', err1, err2);
      return null; // 압축 불가 → 호출 측이 원본 사용
    }
  }

  let { width, height } = source;

  // 이미 작으면 압축 불필요
  if (width <= IMAGE_MAX_DIMENSION && height <= IMAGE_MAX_DIMENSION && file.size < 500 * 1024) {
    bitmap?.close();
    return file;
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
  if (!ctx) {
    bitmap?.close();
    return file;
  }
  ctx.drawImage(source, 0, 0, width, height);
  bitmap?.close(); // 명시적 메모리 해제 — 모바일에서 중요

  return new Promise((resolve) => {
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
  });
}

export async function uploadFile(
  file: File,
  userId: string,
  recordId: string,
): Promise<{ path: string; url: string }> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('JPG, PNG, WebP, PDF 파일만 업로드 가능합니다.');
  }

  // PDF 는 압축 안 되므로 원본 5MB 검사. 이미지는 압축 후 검사 (보통 1MB 미만).
  if (file.type === 'application/pdf' && file.size > MAX_FILE_SIZE) {
    throw new Error('PDF 는 5MB 이하만 가능합니다.');
  }

  // 이미지면 압축 시도. compressImage 가 null 반환 = 디코딩 실패 (HEIC 등 비표준).
  // 그 경우 원본 그대로 업로드 (30MB 한도 안에서).
  let uploadTarget: File;
  if (isImageType(file.type)) {
    const compressed = await compressImage(file);
    if (compressed === null) {
      // 압축 fail → 원본 사용. 30MB 한도 안에서 허용.
      if (file.size > MAX_UNCOMPRESSED_SIZE) {
        throw new Error('사진을 처리할 수 없어요. 다른 사진을 시도해주세요.');
      }
      uploadTarget = file;
    } else {
      uploadTarget = compressed;
      // 압축 성공 케이스만 5MB 검사 (1600px + WebP 면 사실상 안 발생).
      if (uploadTarget.size > MAX_FILE_SIZE) {
        throw new Error('파일이 너무 커서 업로드할 수 없어요. 다른 파일을 시도해주세요.');
      }
    }
  } else {
    uploadTarget = file;
  }

  const ext = uploadTarget.type === 'image/webp' ? 'webp' : file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${userId}/${recordId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, uploadTarget);

  if (error) throw error;

  // bucket 은 private — signedUrl 만 발급. 1시간 유효, 만료 시 UI 측에서 onError 핸들러로 재발급.
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600);

  if (urlError) throw urlError;

  logActivity(userId, 'file.upload', {
    resourceType: 'record_file',
    resourceId: recordId,
    details: { fileName: file.name, fileSize: file.size, fileType: file.type },
  });

  return { path: filePath, url: urlData.signedUrl };
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
