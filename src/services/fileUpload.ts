import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'medical-files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `${userId}/${recordId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return { path: filePath, url: urlData.publicUrl };
}

export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) throw error;
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
