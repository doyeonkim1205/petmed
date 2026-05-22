/**
 * 이미지 압축 헬퍼 — Vision API 업로드 전 클라이언트 사이드 리사이즈/압축.
 *
 * Vision API 비용은 token 수에 비례 → 큰 이미지는 비용 폭증.
 * 또한 모바일 카메라 원본은 5~10MB 흔함 → 네트워크 시간 단축 필요.
 *
 * 전략:
 *   - 최대 변 1280px 로 리사이즈 (Vision detail=auto 기준 충분)
 *   - JPEG 0.8 quality (일반적인 진단용 사진엔 손실 거의 무인지)
 *   - 결과 dataURL (base64) 반환 — Vision API 가 image_url 로 받음
 *
 * 보안/UX:
 *   - 원본 파일 객체는 사용자 디바이스 밖으로 나가지 않음
 *   - 결과 base64 만 서버로 전송
 */

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2MB — 서버 가드와 일치

export interface CompressedImage {
  /** 'data:image/jpeg;base64,...' 형식 */
  dataUrl: string;
  /** 압축 후 추정 바이트 (base64 길이 * 0.75) */
  approxBytes: number;
  width: number;
  height: number;
}

/**
 * File 또는 Blob 을 리사이즈 + JPEG 압축한 base64 dataURL 로 변환.
 *
 * @throws Error  파일이 이미지가 아니거나, 디코딩 실패, 결과가 2MB 초과 시
 */
export async function compressImage(file: File | Blob): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있어요');
  }

  // 1. File → HTMLImageElement (createImageBitmap 이 더 빠르지만
  //    iOS Safari 호환성 위해 Image 사용)
  const objectUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  // 2. 리사이즈 비율 계산 (가로/세로 중 긴 쪽 기준 1280)
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longSide > MAX_SIDE ? MAX_SIDE / longSide : 1;
  const targetW = Math.round(img.naturalWidth * scale);
  const targetH = Math.round(img.naturalHeight * scale);

  // 3. Canvas 로 그리고 JPEG 변환
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 변환에 실패했어요');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  // base64 길이 * 0.75 ≈ 디코딩된 바이트 수 (data:image/jpeg;base64, prefix 제외)
  const base64Body = dataUrl.split(',')[1] || '';
  const approxBytes = Math.floor((base64Body.length * 3) / 4);

  if (approxBytes > MAX_OUTPUT_BYTES) {
    throw new Error('이미지가 너무 커요 더 작은 사진을 사용해 주세요');
  }

  return { dataUrl, approxBytes, width: targetW, height: targetH };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    img.src = src;
  });
}
