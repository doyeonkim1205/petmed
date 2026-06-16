/**
 * 네이티브(Capacitor) 앱에서의 소셜 로그인.
 *
 * 웹/TWA 는 기존 supabase.auth.signInWithOAuth(브라우저 리다이렉트) 를 쓰고,
 * 네이티브 앱에서만 OS 레벨 계정 선택 시트를 띄워 URL/브라우저 없이 로그인한다.
 *
 * 흐름(구글): @capgo/capacitor-social-login → Credential Manager 로 idToken 획득
 *           → supabase.auth.signInWithIdToken({provider:'google'}) 로 세션 생성.
 *
 * 이 모듈은 isNativeApp() 가드 뒤에서 동적 import 되므로 웹 번들엔 별도 청크로
 * 분리되고, 웹/TWA 사용자는 절대 로드하지 않는다.
 */
import { supabase } from '@/lib/supabase';

// Supabase 구글 OAuth 와 동일한 Web client ID (프로젝트 410413803951).
// 네이티브가 받은 idToken 의 audience 가 이 값이어야 Supabase 가 검증을 통과한다.
const GOOGLE_WEB_CLIENT_ID =
  '410413803951-sctmkic11eh1th44b60oc3mkn5bg95nf.apps.googleusercontent.com';

let googleInitialized = false;

async function getSocialLogin() {
  const mod = await import('@capgo/capacitor-social-login');
  return mod.SocialLogin;
}

/** 네이티브 구글 로그인 → Supabase 세션 생성. 성공 시 onAuthStateChange(SIGNED_IN) 가 후속 처리. */
export async function nativeGoogleSignIn(): Promise<void> {
  const SocialLogin = await getSocialLogin();

  if (!googleInitialized) {
    await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
    googleInitialized = true;
  }

  // scopes 를 넘기지 않는다 — 커스텀 scopes 는 MainActivity 수정을 요구하고(@capgo),
  // 우리는 인증용 idToken 만 필요. email/profile/openid 는 플러그인이 기본 포함하며
  // idToken 클레임에 email·이름이 담겨 Supabase 인증에 충분하다. (Credential Manager 계정 시트)
  const res = await SocialLogin.login({
    provider: 'google',
    options: {},
  });

  // 플러그인은 토큰을 res.result 에 담는다 (res.idToken 아님).
  const idToken = (res as { result?: { idToken?: string } }).result?.idToken;
  if (!idToken) {
    throw new Error('구글 로그인 토큰(idToken)을 받지 못했습니다.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
}
