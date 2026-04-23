import { Loader2 } from 'lucide-react';

/**
 * 앱 초기 로딩 중 (AuthContext 가 세션 검증 중) 표시되는 풀스크린.
 * 이전에는 빈 흰 div 였는데 TWA 에서 아무 것도 안 보여서 "앱이 멈췄나?"
 * 느낌이 났음. 스피너 하나만으로 "진행 중" 시그널.
 * motion-reduce 접근성 설정이 켜진 기기에선 스피너 회전이 멈춤.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2
        size={28}
        className="text-blue-400 animate-spin motion-reduce:animate-none"
        aria-label="로딩 중"
      />
    </div>
  );
}
