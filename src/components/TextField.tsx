'use client';

import { forwardRef } from 'react';

/**
 * 앱 전역에서 쓰는 일반 텍스트 입력 필드.
 *
 * 왜 input 직접 안 쓰고 이 컴포넌트?
 *   Chrome on Android 가 type="text" 인 input 위쪽에 "결제 / 비밀번호 / 주소"
 *   autofill 칩을 집요하게 띄움. autoComplete="off" 와 name 속성을 줘도 무시됨.
 *   그러나 type="search" 는 검색창으로 인식해서 autofill 을 안 띄움.
 *   여기서 type="search" 를 기본값으로 강제 + 네이티브 X 버튼 / iOS searchfield
 *   chrome 을 CSS 로 숨겨서 일반 text input 처럼 보이게 함.
 *
 * 숫자/날짜/체크박스 등은 type prop 으로 override 해서 그대로 사용.
 */
type Props = React.InputHTMLAttributes<HTMLInputElement>;

const HIDE_SEARCH_AFFORDANCE =
  ' appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden';

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  {
    type = 'search',
    autoComplete = 'off',
    enterKeyHint = 'next',
    className = '',
    ...rest
  },
  ref,
) {
  // type 이 'search' 일 때만 X 버튼/검색필드 chrome 숨김 (override 케이스 보호).
  const finalClass = type === 'search' ? `${className}${HIDE_SEARCH_AFFORDANCE}` : className;
  return (
    <input
      ref={ref}
      type={type}
      autoComplete={autoComplete}
      enterKeyHint={enterKeyHint}
      className={finalClass}
      {...rest}
    />
  );
});
