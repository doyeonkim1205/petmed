'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { supabase, Profile } from '@/lib/supabase';
import { cleanupOldCache } from '@/lib/cacheCleanup';
import { logActivity } from '@/lib/activityLog';
import { getEffectivePlan } from '@/lib/plans';
import { platformAuth } from '@/lib/platform';
// 배럴(auth/push/billing/location re-export) 말고 env 직접 import.
//   로그인은 모든 유저가 타는 핵심 경로라 네이티브 어댑터 코드를 끌어오지 않게 한다.
//   (getPlatform 은 deviceSession.claimDevice 내부로 이동)
import { isNativeApp } from '@/lib/platform/env';
import { syncDeviceSession, markPendingClaim, clearPendingClaim } from '@/lib/deviceSession';
import { LOCALE_COOKIE } from '@/i18n/config';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithKakao: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'auth', action: 'fetch-profile' },
      });
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const ensureProfile = async (authUser: User) => {
    const metadata = authUser.user_metadata;
    let avatarUrl = metadata?.avatar_url || metadata?.picture || metadata?.profile_image || null;
    // Fix Kakao HTTP URLs → HTTPS (mixed content blocked on mobile)
    if (avatarUrl && avatarUrl.startsWith('http://')) {
      avatarUrl = avatarUrl.replace('http://', 'https://');
    }
    const nickname =
      metadata?.full_name ||
      metadata?.name ||
      metadata?.nickname ||
      authUser.email?.split('@')[0] ||
      '사용자';

    // First try insert (new user)
    await supabase.from('profiles').upsert({
      id: authUser.id,
      email: authUser.email ?? '',
      nickname,
      avatar_url: avatarUrl,
    }, { onConflict: 'id', ignoreDuplicates: true });

    // Always update avatar_url if we have one (handles Kakao HTTP→HTTPS fix too)
    if (avatarUrl) {
      await supabase.from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', authUser.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Auto-cleanup cache items older than 6 months
    cleanupOldCache();

    // Safety timeout: if everything hangs, at least stop showing loading
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // Initialize auth state
    const init = async () => {
      try {
        // 0) '자동 로그인' OFF 처리:
        //    - 앱을 완전 종료 후 재실행한 "첫 mount" 에서만 세션 정리 (sessionStorage 로 구분)
        //    - 로그인 성공 후 Provider 재마운트 케이스에서는 실행하지 않음 (로그인 즉시 끊기는 사태 방지)
        if (typeof window !== 'undefined') {
          const alreadyInitialized = sessionStorage.getItem('auth_initialized');
          sessionStorage.setItem('auth_initialized', '1');
          if (!alreadyInitialized && localStorage.getItem('autoLogin') === 'false') {
            await supabase.auth.signOut({ scope: 'local' });
            if (mounted) {
              setUser(null);
              setSession(null);
              setProfile(null);
              setLoading(false);
            }
            return;
          }
        }

        // 1) Quick check: is there a session in localStorage?
        const { data: { session: localSession } } = await supabase.auth.getSession();
        if (!localSession) {
          if (mounted) setLoading(false);
          return;
        }

        // 2) 병렬 검증 + 초기 데이터 로드
        //    이전엔 getUser → sessions POST → fetchProfile 을 순차 await 해서
        //    흰 화면이 600-1200ms 걸렸음. 세 요청은 서로 의존성이 없으므로
        //    Promise.allSettled 로 동시 실행. 가장 느린 하나만큼만 기다림
        //    (실측 ~400ms). 실패한 항목은 개별 처리.
        //
        //    fetchProfile 에는 localSession.user.id 를 쓰는 게 안전: 같은
        //    세션 객체의 user.id 는 정상 케이스에서 getUser 결과와 100% 일치.
        //    (유저 A 세션에 유저 B 가 서버 측에서 붙는 시나리오는 Supabase
        //     보안 모델상 불가능)
        // 기기 세션: 진짜 새 로그인이면 claim(슬롯 차지), 아니면(앱 복원/갱신) verify(읽기전용).
        //   앱 로드마다 claim 하던 기존 동작이 핑퐁의 원인이라 복원 시엔 검증만 한다.
        //   verify 가 밀려남(403)을 감지하면 authFetch 가 자동 로그아웃+리다이렉트.
        const [verifyResult, sessionsResult, profileResult] = await Promise.allSettled([
          supabase.auth.getUser(),
          syncDeviceSession(localSession.user),
          fetchProfile(localSession.user.id),
        ]);

        if (!mounted) return;

        // getUser 결과 해석.
        // - 성공 + user 있음: 세션 유효
        // - 성공 + user 없음 or 명시적 401: 세션 무효 → 로그아웃
        // - 네트워크 에러 (rejected): 로그아웃하지 않음 (잘못 끊으면 억울함).
        //   다음 API 호출에서 자연스레 authFetch 의 session_evicted 경로 탐.
        if (verifyResult.status === 'fulfilled') {
          const { data: { user: verifiedUser }, error: verifyError } = verifyResult.value;
          const explicitlyInvalid = !verifiedUser || (verifyError && (verifyError as any).status === 401);
          if (explicitlyInvalid) {
            console.warn('Session invalid, clearing:', verifyError?.message);
            await supabase.auth.signOut({ scope: 'local' });
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setUser(verifiedUser);
        } else {
          // 네트워크 에러 — localSession.user 로 진행 (낙관적 아님: 결국 세션
          // 유효하다면 다음 API 호출도 정상, 무효면 자연 로그아웃됨)
          setUser(localSession.user);
        }

        setSession(localSession);
        setProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
        setLoading(false);
        // sessionsResult 실패는 무시 (기존 동작 유지). 다음 API 호출 시
        // 필요하면 재등록되거나 session_evicted 가 뜸.
        void sessionsResult;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'auth', action: 'init' },
        });
        console.error('Auth init error:', err);
        if (mounted) setLoading(false);
      }
    };

    init();

    // Listen for subsequent auth changes (sign in, sign out, token refresh)
    // CRITICAL: This callback MUST be synchronous (not async).
    // supabase-js awaits all onAuthStateChange callbacks inside _notifyAllSubscribers(),
    // which runs inside _initialize(). If this callback calls any Supabase DB operation,
    // that operation calls getSession() which awaits initializePromise (= _initialize()),
    // creating a circular wait → DEADLOCK. All DB work is deferred via setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        // Synchronous state updates — safe, no Supabase calls
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Defer DB operations to next tick to break the deadlock chain
        const authUser = newSession.user;
        const isSignIn = event === 'SIGNED_IN';
        setTimeout(async () => {
          if (!mounted) return;
          if (isSignIn) {
            try { await ensureProfile(authUser); } catch {}
            // 중복 방지: SIGNED_IN 은 멀티탭 / OAuth 콜백 / 탭 포커스 / 리프레시 등에서
            // 여러 번 fire 됨. 예전엔 access_token 끝자리로 dedup 했는데 토큰이 ~1시간마다
            // 회전해서 재기록됐다 → "유저별 하루 1회"로 변경 (키=user.id, 값=오늘 날짜).
            // 같은 날 재진입/갱신은 skip, 날짜 바뀌면 다시 기록.
            // 3분류: 신규가입(auth.signup) / 진짜 재로그인(auth.login) / 앱실행·세션복원(app.open).
            //   판별 = user.last_sign_in_at 이 방금(<90s)이면 "진짜 인증", 아니면 "앱실행(복원)".
            //   진짜 인증 중 created_at≈last_sign_in_at(거의 동시) 이면 신규가입.
            //   (토큰갱신은 last_sign_in_at 안 바꿈 → 자동으로 app.open 으로 분류됨)
            try {
              const provider = authUser.app_metadata?.provider || 'unknown';
              const now = Date.now();
              const lastSignInAt = authUser.last_sign_in_at;
              const createdAt = authUser.created_at;
              const freshAuth = lastSignInAt ? (now - new Date(lastSignInAt).getTime() < 90_000) : false;

              if (freshAuth && lastSignInAt) {
                // 진짜 로그인/가입 — 한 인증당 SIGNED_IN 여러 번 fire → last_sign_in_at 값으로 dedup
                const k = `authEventLogged_${authUser.id}`;
                if (localStorage.getItem(k) !== lastSignInAt) {
                  localStorage.setItem(k, lastSignInAt);
                  const isSignup = !!createdAt && Math.abs(new Date(createdAt).getTime() - new Date(lastSignInAt).getTime()) < 10_000;
                  logActivity(authUser.id, isSignup ? 'auth.signup' : 'auth.login', { details: { method: provider } });
                }
              } else {
                // 기존 유저 앱 실행/세션 복원 — DAU, 하루 1회
                const today = new Date().toISOString().slice(0, 10);
                const k = `appOpenLogged_${authUser.id}`;
                if (localStorage.getItem(k) !== today) {
                  localStorage.setItem(k, today);
                  logActivity(authUser.id, 'app.open', { details: { method: provider } });
                }
              }
              // 구버전 키 정리
              for (const kk of Object.keys(localStorage)) {
                if (kk.startsWith('authLoginLogged_')) localStorage.removeItem(kk);
              }
            } catch {
              const provider = authUser.app_metadata?.provider || 'unknown';
              logActivity(authUser.id, 'auth.login', { details: { method: provider } });
            }
          }
          // 기기 세션: 진짜 새 로그인이면 claim(슬롯 차지+오래된 기기 evict),
          //   아니면(세션 복원/토큰 갱신/탭 포커스) verify(읽기전용)만.
          //   SIGNED_IN 은 복원·갱신에도 fire 되므로 여기서 매번 claim 하면 옛 기기가
          //   슬롯을 도로 뺏는 핑퐁이 생긴다 → fresh 로그인일 때만 claim.
          await syncDeviceSession(authUser);
          const profileData = await fetchProfile(authUser.id);
          if (mounted) {
            setProfile(profileData);
            setLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // ── 푸시 알림 자동 재구독 (silent) ──
  //
  // 조건이 모두 맞으면 사용자한테 아무것도 안 묻고 조용히 구독을 만들어 둔다:
  //   1) user / profile 로드 완료
  //   2) profile.is_push_enabled !== false  (사용자가 명시적으로 OFF 한 적 없음)
  //   3) effective plan === 'plus'          (무료는 서버가 어차피 거부)
  //   4) Notification.permission === 'granted'  (과거에 허용한 적 있음)
  //   5) getSubscription() === null          (실제 구독이 없음 → "유령 상태" 감지)
  //
  // 왜 필요:
  //   - SW 캐시 bump / TWA 재설치 등으로 구독이 무효화됐지만 permission 은
  //     granted 로 남아있는 유저들을 자동 복구 (self-healing).
  //   - cron 이 410/404 응답 받으면 DB row 삭제 → 다음 앱 방문 시 이 로직이
  //     getSubscription()=null 을 감지하고 새 구독 생성.
  //
  // 안전장치:
  //   - 모든 실패는 Sentry 로만 로깅. 앱 로딩 차단 X.
  //   - 이미 구독 있으면 early return → 네트워크 호출 0 (반복 호출 무해).
  //   - cancelled flag 로 unmount 후 DB 업데이트 방지.
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.is_push_enabled === false) return;
    if (getEffectivePlan(profile.plan) !== 'plus') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    let cancelled = false;

    // 핵심 auto-resub 로직. 권한 체크 포함 (외부에서 호출 시마다 최신 권한 읽음).
    //
    // "유령 구독" 대응: 브라우저는 getSubscription() 으로 살아있다고 응답하지만
    // cron 이 410/404 로 DB 에서 삭제한 경우. 기존 로직은 `existingSub` 있으면
    // early return 이라 DB 복구가 안 됐음. 이제는 existingSub 가 있어도 DB 에
    // upsert (idempotent) 해서 동기화.
    const runAutoResub = async () => {
      if (cancelled) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (!sub) {
          // VAPID public key → Uint8Array 변환 (urlsafe base64 decode)
          const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
          const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
          const raw = atob(base64);
          const arr = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: arr,
          });
          if (cancelled) return;
        }

        // DB 에 upsert (새 구독이든 기존 유령 구독이든). /api/push/subscribe 는
        // (user_id, endpoint) unique constraint upsert 라 중복 호출 안전.
        const json = sub.toJSON();
        const { authFetch } = await import('@/lib/authFetch');
        await authFetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys_p256dh: json.keys?.p256dh,
            keys_auth: json.keys?.auth,
          }),
        });
        if (cancelled) return;

        // null → true 로 업데이트 (다음 앱 로드 시 이 로직 불필요하게 안 돌게).
        // true 였으면 스킵 (DB 쓰기 아낌).
        if (profile.is_push_enabled !== true) {
          await supabase.from('profiles')
            .update({ is_push_enabled: true })
            .eq('id', user.id);
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { feature: 'push', action: 'auto-resub' } });
      }
    };

    // 초기 실행
    runAutoResub();

    // 권한 변경 실시간 감지 — 사용자가 설정에서 "차단" → "허용" 으로 바꾼 경우
    // 앱 재시작 없이 자동 재구독 시도.
    let permStatus: PermissionStatus | null = null;
    const onPermChange = () => {
      if (permStatus && permStatus.state === 'granted') runAutoResub();
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then(s => {
        permStatus = s;
        s.addEventListener('change', onPermChange);
      }).catch(() => {});
    }

    // 백업: 탭이 다시 활성화될 때 한 번 더 시도 (설정 앱 다녀온 경우).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runAutoResub();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      permStatus?.removeEventListener('change', onPermChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, profile]);

  // 네이티브 FCM 토큰 재귀속 — 같은 기기에서 계정이 바뀌어도 토큰 소유자를 현재 계정에 일치시킨다.
  //   (로그아웃 정리만으론 '강제종료 후 다른 계정 로그인' / 이미 누수된 기존 토큰을 못 잡음)
  //   - Plus + 푸시 켠 유저: registerNativePush() → upsert(onConflict token)로 토큰을 현재 계정에 claim.
  //     (이미 권한 허용 상태라 prompt 없음; is_push_enabled===true 일 때만 → 임의 권한팝업 방지)
  //   - 그 외(무료/푸시 끔): unregisterNativePush() → 기기 토큰을 token 기준으로 삭제(누수 토큰 청소).
  useEffect(() => {
    if (!isNativeApp()) return;
    if (!user || !profile) return;
    const eligible = getEffectivePlan(profile.plan) === 'plus' && profile.is_push_enabled === true;
    let cancelled = false;
    (async () => {
      try {
        const { registerNativePush, unregisterNativePush } = await import('@/lib/platform');
        if (cancelled) return;
        // prompt:false → 이미 권한 허용된 기기에서만 조용히 재귀속 (로그인 시 권한 팝업 X).
        if (eligible) await registerNativePush({ prompt: false });
        else await unregisterNativePush();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user, profile]);

  const signUp = async (email: string, password: string, nickname: string) => {
    try {
      markPendingClaim(); // 가입=첫 로그인 → 이 기기가 슬롯 claim
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, email, nickname });
        if (profileError) throw profileError;
        // 서버측(/api/activity, service role)으로 기록 — 클라 insert 는 직후 화면 이동/세션
        // 타이밍과 race 로 0건 됐었음. authFetch 로 검증 세션 + await 보장.
        try {
          const { authFetch } = await import('@/lib/authFetch');
          await authFetch('/api/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'auth.signup' }),
          });
        } catch {}
      }

      return { error: null };
    } catch (error) {
      clearPendingClaim();
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      markPendingClaim(); // 로그인 시도 → 다음 SIGNED_IN 에서 이 기기가 슬롯 claim
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // 이 시점에 logActivity 호출하면 onAuthStateChange 의 SIGNED_IN 핸들러
      // 와 중복됨 (로그 2건). sessionStorage dedupe 가 onAuthStateChange 에
      // 있으므로 여기선 제거.
      void data;
      return { error: null };
    } catch (error) {
      clearPendingClaim();
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      markPendingClaim();
      await platformAuth.loginWithGoogle();
      return { error: null };
    } catch (error) {
      clearPendingClaim();
      return { error: error as Error };
    }
  };

  const signInWithKakao = async () => {
    try {
      markPendingClaim();
      await platformAuth.loginWithKakao();
      return { error: null };
    } catch (error) {
      clearPendingClaim();
      return { error: error as Error };
    }
  };

  const signInWithApple = async () => {
    try {
      markPendingClaim();
      await platformAuth.loginWithApple();
      return { error: null };
    } catch (error) {
      clearPendingClaim();
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // 다음 로그인이 깨끗하게 claim 하도록 잔여 pendingClaim 표시 해제.
    clearPendingClaim();
    // Log before clearing state — 서버측(/api/activity, service role)으로 기록.
    // 클라 logActivity 는 signOut teardown(세션 정리)과 race 로 RLS insert 가 0건 됐음.
    // authFetch 로 아직 유효한 JWT 를 보내 서버에서 확실히 기록(await).
    if (user) {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        await authFetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'auth.logout' }),
        });
      } catch {}
      // Remove device session
      try {
        const { getDeviceId } = await import('@/lib/deviceId');
        const { authFetch } = await import('@/lib/authFetch');
        await authFetch('/api/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: getDeviceId() }),
        });
      } catch {}

      // 푸시 구독 해제 — 로그아웃한 기기에 이전 계정 알림이 계속 배달되는
      // 문제 방지. 브라우저 레벨에서 unsubscribe + DB row 삭제.
      // 네트워크/브라우저 에러가 로그아웃 흐름을 차단하지 않도록 try/catch 로 감쌈.
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            const endpoint = sub.endpoint;
            // DB row 먼저 삭제 (토큰 아직 유효한 동안)
            try {
              const { authFetch } = await import('@/lib/authFetch');
              await authFetch('/api/push/subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint }),
              });
            } catch {}
            // 브라우저 레벨 해제 — 이후 이 기기엔 push 이벤트 자체가 안 옴
            await sub.unsubscribe();
          }
        }
      } catch {}

      // 네이티브 FCM 토큰 해제 — 같은 기기에서 계정 전환 시 이전 계정 복약 알림이
      //   새 계정으로 새어나가는 것 차단. ⚠️ signOut 이전(JWT 유효할 때) 실행해야 삭제 API 성공.
      if (isNativeApp()) {
        try {
          const { unregisterNativePush } = await import('@/lib/platform');
          await unregisterNativePush();
        } catch {}
      }
    }

    // 1) Clear React state immediately
    setUser(null);
    setProfile(null);
    setSession(null);

    // 2) Clear auth tokens from localStorage (synchronous, guaranteed)
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    // 2.1) 언어 쿠키 초기화 — 언어는 계정 종속. 안 지우면 이전 계정의 언어가
    // 다음 로그인 계정으로 새어나감(공유 기기). 다음 로그인 시 그 계정의
    // preferred_language(없으면 기본 ko)가 LocaleSync 로 다시 적용됨.
    try { document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; SameSite=Lax`; } catch {}

    // 2.5) Clear all record draft storage — defense in depth.
    // Draft 키에 userId 가 포함되어 격리는 보장되지만, 같은 디바이스에서 사용자
    // 전환 시 이전 사용자의 draft 잔존 방지 + 디스크 정리.
    try {
      const { clearAllDraftStorage } = await import('@/lib/recordDraft');
      clearAllDraftStorage();
    } catch {}

    // 2.6) Clear all SWR memory cache — 공유 기기에서 다른 사용자 로그인 시
    // 이전 사용자의 캐시 (건강 브리핑 등) 가 잠깐 노출되는 보안 risk 차단.
    try {
      const { clearAllSWRCache } = await import('@/lib/swrCache');
      clearAllSWRCache();
    } catch {}

    // 3) Tell Supabase to sign out (fire-and-forget)
    supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  };

  const refreshProfile = async () => {
    if (!user) return;
    const freshProfile = await fetchProfile(user.id);
    setProfile(freshProfile);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const prevProfile = profile;
    setProfile(prev => prev ? { ...prev, ...updates } : null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      logActivity(user.id, 'profile.update', { details: { fields: Object.keys(updates) } });
      const freshProfile = await fetchProfile(user.id);
      setProfile(freshProfile);
      return { error: null };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'auth', action: 'update-profile' },
        extra: { userId: user?.id },
      });
      setProfile(prevProfile);
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, profile, session, loading,
        signUp, signIn, signInWithGoogle, signInWithKakao, signInWithApple, signOut, updateProfile, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
