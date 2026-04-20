'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { supabase, Profile } from '@/lib/supabase';
import { cleanupOldCache } from '@/lib/cacheCleanup';
import { logActivity } from '@/lib/activityLog';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithKakao: () => Promise<{ error: Error | null }>;
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

        // 2) VERIFY session is actually valid (server round-trip)
        const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser();

        if (verifyError || !verifiedUser) {
          // Session expired or revoked — clear it
          console.warn('Session invalid, clearing:', verifyError?.message);
          await supabase.auth.signOut({ scope: 'local' });
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // 3) Session is valid — set everything
        if (mounted) {
          setSession(localSession);
          setUser(verifiedUser);
          // Register device session BEFORE unlocking pages (prevents race with API calls)
          try {
            const { getDeviceId } = await import('@/lib/deviceId');
            const { authFetch } = await import('@/lib/authFetch');
            await authFetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_id: getDeviceId() }),
            });
          } catch {}
          const profileData = await fetchProfile(verifiedUser.id);
          if (mounted) {
            setProfile(profileData);
            setLoading(false);
          }
        }
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
            // 중복 방지: SIGNED_IN 은 멀티탭 / OAuth 콜백 / 탭 포커스 /
            // 리프레시 등에서 여러 번 fire 됨. sessionStorage 는 탭마다
            // 분리돼서 멀티탭 상황에 무용 → localStorage 로 변경.
            // 키 = session 지문 (access_token 끝 24자) — 한 세션 = 한 번만.
            // 새 세션이 시작되면 자동으로 새 키 → 다시 로깅.
            try {
              const fingerprint = newSession.access_token?.slice(-24) ?? authUser.id;
              const key = `authLoginLogged_${fingerprint}`;
              if (!localStorage.getItem(key)) {
                localStorage.setItem(key, String(Date.now()));
                // 오래된 키 정리 (24시간 지난 것)
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                for (const k of Object.keys(localStorage)) {
                  if (k.startsWith('authLoginLogged_')) {
                    const ts = Number(localStorage.getItem(k) ?? 0);
                    if (ts < cutoff) localStorage.removeItem(k);
                  }
                }
                const provider = authUser.app_metadata?.provider || 'unknown';
                logActivity(authUser.id, 'auth.login', { details: { method: provider } });
              }
            } catch {
              // localStorage 접근 불가 (privacy mode 등) 시 기존대로
              const provider = authUser.app_metadata?.provider || 'unknown';
              logActivity(authUser.id, 'auth.login', { details: { method: provider } });
            }
          }
          // Always register device session first (prevents race with API calls)
          try {
            const { getDeviceId } = await import('@/lib/deviceId');
            const { authFetch } = await import('@/lib/authFetch');
            await authFetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_id: getDeviceId() }),
            });
          } catch {}
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

  const signUp = async (email: string, password: string, nickname: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, email, nickname });
        if (profileError) throw profileError;
        logActivity(data.user.id, 'auth.signup');
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // 이 시점에 logActivity 호출하면 onAuthStateChange 의 SIGNED_IN 핸들러
      // 와 중복됨 (로그 2건). sessionStorage dedupe 가 onAuthStateChange 에
      // 있으므로 여기선 제거.
      void data;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'consent', access_type: 'offline' },
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithKakao = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'profile_nickname profile_image account_email',
          queryParams: { prompt: 'login,consent' },
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Log before clearing state
    if (user) {
      logActivity(user.id, 'auth.logout');
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
        signUp, signIn, signInWithGoogle, signInWithKakao, signOut, updateProfile, refreshProfile,
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
