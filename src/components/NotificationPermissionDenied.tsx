'use client';

import { Bell, X } from 'lucide-react';
import { openDefaultAppsSettings } from '@/lib/androidIntents';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 알림 사용 불가 상황 안내 모달.
 *
 * 호출 시점:
 *   - Samsung Internet 유저가 토글 ON 시도 (Samsung Push Service 는
 *     web-push 가 공식 지원 안 해서 결국 알림 도달 불안정 → 미리 차단)
 *   - Chrome 등에서 Notification.requestPermission() 이 denied 로 리턴
 *
 * Samsung 인 경우: Chrome 으로 전환 유도
 * 그 외: 브라우저 설정에서 차단 해제 안내
 */
export function NotificationPermissionDenied({ open, onClose }: Props) {
  if (!open) return null;

  const isSamsung = typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-0.5 text-gray-300 hover:text-gray-500"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-orange-500" />
          </div>
          <p className="text-sm font-bold text-gray-800">알림 수신이 어려워요</p>
        </div>

        {isSamsung ? (
          <>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              현재 <span className="font-bold text-gray-700">삼성 브라우저의 일부 설정</span>으로 인해
              알림 수신이 원활하지 않을 수 있습니다.
              <br /><br />
              중요한 알림을 놓치지 않으려면 <span className="font-bold text-gray-700">크롬(Chrome) 브라우저</span>를 이용해 주세요.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { openDefaultAppsSettings(); onClose(); }}
                className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-full"
              >
                Chrome 으로 전환
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-gray-400 text-xs font-bold"
              >
                나중에 하기
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              이전에 알림을 <span className="font-bold text-gray-700">차단</span> 하셔서 권한 요청이 막혀 있어요.
              <br /><br />
              Chrome 앱의 <span className="font-bold text-gray-700">설정 → 사이트 설정 → 알림</span> 에서
              <span className="font-bold text-gray-700"> pawdex.store</span> 를 <span className="font-bold text-gray-700">허용</span> 으로 변경 후 다시 시도해주세요.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-full"
            >
              확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}
