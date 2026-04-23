import { Loader2 } from 'lucide-react';
import { PawIcon } from '@/components/icons/PawIcon';

/**
 * 앱 초기 로딩 중 (AuthContext 가 세션 검증 중) 표시되는 풀스크린.
 *
 * 이전에는 빈 흰 div 였는데 TWA 에서 1~3초간 아무 것도 안 보여서 "앱이 멈췄나?"
 * 느낌이 컸음. 홈 화면과 동일한 로고 + 스피너로 브랜드 유지 + 진행 중 시그널.
 *
 * motion-reduce 접근성 설정이 켜진 기기에선 스피너 회전이 멈춤 (정적 표시).
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-5 flex items-center gap-2">
        <PawIcon size={32} className="text-blue-800 dark:text-blue-300" />
        PawDex
      </h1>
      <Loader2
        size={24}
        className="text-blue-400 animate-spin motion-reduce:animate-none"
        aria-label="로딩 중"
      />
    </div>
  );
}
