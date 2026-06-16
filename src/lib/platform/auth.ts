/**
 * 인증 어댑터 레이어.
 *
 * 화면/컨텍스트는 `platformAuth.loginWithGoogle()` / `loginWithKakao()` 만 호출하고,
 * 내부에서 플랫폼별로 갈린다:
 *   - 웹/TWA  : Supabase OAuth (브라우저 리다이렉트 → /auth/callback)
 *   - 네이티브 : OS 계정 시트(구글) / 카카오 SDK → idToken → signInWithIdToken (URL 없음)
 *
 * 네이티브 구현은 isNativeApp() 가드 뒤에서 동적 import 되므로, 웹/TWA 번들엔 별도
 * 청크로 분리되어 절대 로드되지 않는다 (Capacitor 코드가 웹 번들에 섞이지 않음).
 */
import { supabase } from '@/lib/supabase';
import { isNativeApp } from './env';

// Supabase 구글 OAuth 와 동일한 Web client ID (GCP 프로젝트 410413803951).
// 네이티브 idToken 의 audience 가 이 값이어야 Supabase 검증을 통과한다.
const GOOGLE_WEB_CLIENT_ID =
  '410413803951-sctmkic11eh1th44b60oc3mkn5bg95nf.apps.googleusercontent.com';

let googleInitialized = false;

async function nativeGoogleSignIn(): Promise<void> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!googleInitialized) {
    await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
    googleInitialized = true;
  }
  // scopes 를 넘기지 않는다 — 커스텀 scopes 는 @capgo 가 MainActivity 수정을 요구.
  // email/profile/openid 는 기본 포함되어 idToken 클레임에 담기므로 인증에 충분.
  const res = await SocialLogin.login({ provider: 'google', options: {} });
  const idToken = (res as { result?: { idToken?: string } }).result?.idToken;
  if (!idToken) throw new Error('구글 로그인 토큰(idToken)을 받지 못했습니다.');

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
}

async function nativeKakaoSignIn(): Promise<void> {
  const { KakaoLoginPlugin } = await import('capacitor-kakao-login-plugin');
  const res = await KakaoLoginPlugin.goLogin();
  const idToken = res.idToken; // OIDC 활성화 시 제공
  if (!idToken) {
    throw new Error('카카오 로그인 토큰(idToken)을 받지 못했습니다. (카카오 OIDC 활성화 확인)');
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'kakao', token: idToken });
  if (error) throw error;
}

export const platformAuth = {
  async loginWithGoogle(): Promise<void> {
    if (isNativeApp()) return nativeGoogleSignIn();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'consent', access_type: 'offline' },
      },
    });
    if (error) throw error;
  },

  async loginWithKakao(): Promise<void> {
    if (isNativeApp()) return nativeKakaoSignIn();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'profile_nickname profile_image account_email',
        queryParams: { prompt: 'login,consent' },
      },
    });
    if (error) throw error;
  },
};
