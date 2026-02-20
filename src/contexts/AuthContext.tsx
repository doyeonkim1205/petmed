'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { cleanupOldCache } from '@/lib/cacheCleanup';

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
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const ensureProfile = async (authUser: User) => {
    const metadata = authUser.user_metadata;
    await supabase.from('profiles').upsert({
      id: authUser.id,
      email: authUser.email ?? '',
      nickname:
        metadata?.full_name ||
        metadata?.name ||
        metadata?.nickname ||
        authUser.email?.split('@')[0] ||
        '사용자',
      avatar_url: metadata?.avatar_url || metadata?.picture || null,
    }, { onConflict: 'id', ignoreDuplicates: true });
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
          const profileData = await fetchProfile(verifiedUser.id);
          if (mounted) {
            setProfile(profileData);
            setLoading(false);
          }
        }
      } catch (err) {
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
          }
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
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
      const freshProfile = await fetchProfile(user.id);
      setProfile(freshProfile);
      return { error: null };
    } catch (error) {
      setProfile(prevProfile);
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, profile, session, loading,
        signUp, signIn, signInWithGoogle, signInWithKakao, signOut, updateProfile,
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
