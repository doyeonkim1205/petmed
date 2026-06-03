'use client';

import { useState, useEffect, type ImgHTMLAttributes } from 'react';

interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  // 403/404 발생 시 새 signedUrl 을 다시 받아오는 함수.
  // 1시간 만료 후 재진입한 경우의 자동 복구 경로.
  onRefetchUrl: () => Promise<string>;
  fallbackSrc?: string;
  // wrapper div 클래스 — 외부 박스 크기/모양.
  className?: string;
  // <img> 자체 클래스 — object-fit 등.
  imgClassName?: string;
}

export function SafeImage({
  src,
  onRefetchUrl,
  fallbackSrc,
  className = '',
  imgClassName = '',
  ...imgProps
}: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasRetried, setHasRetried] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 부모가 src prop 을 바꾸면 state 도 갱신 — 재시도 카운터 리셋.
  useEffect(() => {
    setCurrentSrc(src);
    setHasRetried(false);
    setIsLoading(true);
  }, [src]);

  const handleError = async () => {
    if (!hasRetried) {
      setHasRetried(true);
      try {
        const newUrl = await onRefetchUrl();
        setCurrentSrc(newUrl);
      } catch {
        if (fallbackSrc) setCurrentSrc(fallbackSrc);
      }
    } else if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  return (
    <div className={`relative overflow-hidden ${isLoading ? 'bg-gray-100 animate-pulse' : ''} ${className}`}>
      <img
        {...imgProps}
        src={currentSrc}
        onError={handleError}
        onLoad={() => setIsLoading(false)}
        className={`${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'} ${imgClassName}`}
      />
    </div>
  );
}
