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
import { isNativeApp, isIOS } from './env';

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

/** 랜덤 nonce (hex). */
function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 → hex (Web Crypto). */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

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

  // iOS nonce 처리 (Supabase signInWithIdToken):
  //   ① forcePrompt:true → @capgo 가 restorePreviousSignIn(우리 nonce 무시, 캐시 토큰 재사용)
  //      대신 fresh login() 경로를 타게 강제 → 우리 nonce 가 실제 토큰에 반영됨.
  //   ② 정석 패턴: SHA256(raw)=hashed 를 GoogleSignIn(@capgo)에 → 토큰 nonce=hashed,
  //      raw 를 Supabase 에 → GoTrue 가 sha256(raw)=hashed 로 대조 → 일치.
  //   Android(Credential Manager)는 nonce 없이 통과하던 흐름이라 미적용(iOS 한정).
  let rawNonce: string | undefined;
  const options: { nonce?: string; forcePrompt?: boolean } = {};
  if (isIOS()) {
    options.forcePrompt = true;
    rawNonce = randomNonce();
    options.nonce = await sha256Hex(rawNonce);
  }

  const res = await SocialLogin.login({ provider: 'google', options });
  const idToken = (res as { result?: { idToken?: string } }).result?.idToken;
  if (!idToken) throw new Error('구글 로그인 토큰(idToken)을 받지 못했습니다.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    ...(rawNonce ? { nonce: rawNonce } : {}),
  });
  if (error) throw error;
}

async function nativeAppleSignIn(): Promise<void> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  // Apple 은 iOS 네이티브 capability(Sign in with Apple)만 켜져 있으면 별도 초기화 불필요.
  // nonce(구글과 동일 정석): SHA256(raw)=hashed 를 Apple(@capgo)에 → 토큰 nonce=hashed,
  //   raw 를 Supabase 에 → GoTrue 가 sha256(raw) 로 대조 → 일치.
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  const res = await SocialLogin.login({
    provider: 'apple',
    options: { scopes: ['email', 'name'], nonce: hashedNonce },
  });
  const idToken = (res as { result?: { idToken?: string } }).result?.idToken;
  if (!idToken) throw new Error('Apple 로그인 토큰(idToken)을 받지 못했습니다.');
  // Supabase Apple provider 가 활성화돼 있어야 통과 (Client ID=번들ID 등록 필요).
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

async function nativeKakaoSignIn(): Promise<void> {
  if (isIOS()) {
    // iOS: capacitor-kakao-login-plugin 은 SPM(Package.swift) 미지원이라 Cap8.4 SPM
    //   프로젝트에 안 붙는다. → Kakao 공식 iOS SDK 를 쓰는 커스텀 네이티브 브릿지
    //   (KakaoLoginBridge.swift, jsName 'KakaoLogin')로 우회. 평평 JSON({ok,idToken})만 반환.
    //   Android 는 아래 기존 플러그인 그대로 — 운영 무영향(분기 격리).
    const { registerPlugin } = await import('@capacitor/core');
    const KakaoLogin = registerPlugin<{
      login(): Promise<{ ok: boolean; idToken?: string; error?: string }>;
    }>('KakaoLogin');
    const res = await KakaoLogin.login();
    if (!res.ok || !res.idToken) {
      throw new Error(res.error || '카카오 로그인 토큰(idToken)을 받지 못했습니다. (OIDC 확인)');
    }
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'kakao', token: res.idToken });
    if (error) throw error;
    return;
  }

  // Android: 기존 capacitor-kakao-login-plugin 그대로.
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
