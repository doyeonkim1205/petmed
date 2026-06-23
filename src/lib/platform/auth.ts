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
// iOS 전용 OAuth client (GCP 같은 프로젝트). iOSServerClientId=webClientId 로 두면
// 발급 idToken 의 aud 가 webClientId 가 되어 Supabase 검증을 그대로 통과(별도 등록 불필요).
// ⚠️ 이 client ID 는 reversed 형태로 iOS Info.plist URL 스킴에도 등록돼야 한다(콜백용).
const GOOGLE_IOS_CLIENT_ID =
  '410413803951-1n80pqemn9o7d55etpt30c2ouk2novnh.apps.googleusercontent.com';

let googleInitialized = false;

async function nativeGoogleSignIn(): Promise<void> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!googleInitialized) {
    // iOS 필드(iOSClientId/iOSServerClientId)는 Android 에선 무시됨 — 한 번에 안전하게 설정.
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
      },
    });
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

async function nativeAppleSignIn(): Promise<void> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  // Apple 은 iOS 네이티브 capability(Sign in with Apple)만 켜져 있으면 별도 초기화 불필요.
  const res = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });
  const idToken = (res as { result?: { idToken?: string } }).result?.idToken;
  if (!idToken) throw new Error('Apple 로그인 토큰(idToken)을 받지 못했습니다.');
  // Supabase Apple provider 가 활성화돼 있어야 통과 (Service ID/Key 설정 필요).
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken });
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

  /**
   * Apple 로그인 — iOS 네이티브 전용 (웹/Android 비노출).
   * 심사 가이드라인 4.8 대응: 제3자 소셜 로그인 제공 시 Apple 로그인 옵션 필수.
   */
  async loginWithApple(): Promise<void> {
    if (!isNativeApp()) throw new Error('Apple 로그인은 iOS 앱에서만 지원됩니다.');
    return nativeAppleSignIn();
  },

  /**
   * 탈퇴 시 Apple 토큰 revoke 용 일회성 authorizationCode 확보.
   * Apple 은 authorization/refresh 토큰으로만 revoke 가능(idToken 불가)하고 code 는
   * 단명(약 5분)이라, 탈퇴 직전 재인증으로 새로 받아 서버(/api/delete-account)에 넘긴다.
   * ⚠️ @capgo Apple 응답의 authorizationCode 필드명은 실기기에서 검증 필요(현재 추정 매핑).
   * 실패해도 탈퇴는 진행되어야 하므로 호출부에서 best-effort 로 감쌀 것.
   */
  async getAppleRevokeCode(): Promise<string | undefined> {
    if (!isNativeApp()) return undefined;
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      const res = await SocialLogin.login({ provider: 'apple', options: { scopes: [] } });
      const r = (res as {
        result?: { authorizationCode?: string; accessToken?: { token?: string } };
      }).result;
      return r?.authorizationCode ?? r?.accessToken?.token;
    } catch {
      return undefined;
    }
  },
};
