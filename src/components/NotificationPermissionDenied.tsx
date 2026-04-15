'use client';

import { Bell, X } from 'lucide-react';
import { openSamsungInternetAppInfo, openDefaultAppsSettings } from '@/lib/androidIntents';

interface Props {
  open: boolean;
  onClose: () => void;
}

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
          <p className="text-sm font-bold text-gray-800">알림이 차단되어 있습니다</p>
        </div>

        {isSamsung ? (
          <>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              인터넷 설정 문제로 알림 권한을 켤 수 없어요.
              <br />아래 방법 중 하나로 해결해 보세요!
            </p>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-bold text-gray-700 mb-1">방법 A. 삼성 인터넷 설정 초기화</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <span className="font-bold text-gray-600">[저장공간]</span> → <span className="font-bold text-gray-600">[데이터 삭제]</span>를 누른 뒤 앱을 다시 켜주세요.
                  <br />
                  <span className="text-gray-400">(PawDex 관련 데이터만 초기화되며, 북마크 등은 안전합니다)</span>
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-1">방법 B. Chrome 으로 전환 (추천)</p>
                <p className="text-[11px] text-blue-500 leading-relaxed">
                  기본 브라우저를 <span className="font-bold">Chrome</span> 으로 변경하면 가장 안정적으로 작동해요.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { openSamsungInternetAppInfo(); onClose(); }}
                className="w-full py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-full"
              >
                삼성 설정 열기
              </button>
              <button
                onClick={() => { openDefaultAppsSettings(); onClose(); }}
                className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-full"
              >
                Chrome 으로 해결하기
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
              브라우저 설정에서 이 사이트의 <span className="font-bold text-gray-700">알림 차단</span>을 해제해주세요.
              <br /><br />
              Chrome: <span className="font-bold text-gray-700">주소창 왼쪽 자물쇠 아이콘</span> → 사이트 설정 → 알림 → 허용
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
