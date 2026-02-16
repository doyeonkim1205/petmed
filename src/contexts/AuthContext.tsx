'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';

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

  useEffect(() => {
    let fetchingForId: string | null = null;
    const timeout = setTimeout(() => setLoading(false), 3000);

    const handleUser = async (authUser: User) => {
      if (fetchingForId === authUser.id) return;
      fetchingForId = authUser.id;
      await fetchProfile(authUser.id);
    };

    // Initialize: getSession for fast load, then VERIFY with getUser
    const init = async () => {
      try {
        // 1) Read session from localStorage (instant)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setLoading(false);
          return;
        }

        // 2) VERIFY the session is actually valid by calling the server
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();

        if (userError || !verifiedUser) {
          // Session in localStorage is INVALID (expired, revoked, etc.)
          // Clear it so the user sees the login prompt
          console.warn('Session invalid, clearing:', userError?.message);
          await supabase.auth.signOut({ scope: 'local' });
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // 3) Session is valid - set state
        setSession(session);
        setUser(verifiedUser);
        await handleUser(verifiedUser);
      } catch (err) {
        console.error('Auth init error:', err);
        setLoading(false);
      }
    };

    init();

    // Listen for subsequent auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (event === 'SIGNED_IN') {
            try { await ensureProfile(session.user); } catch {}
          }
          await handleUser(session.user);
        } else {
          fetchingForId = null;
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

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
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('signOut error:', err);
    }
    // Force clear auth from localStorage regardless
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
    setUser(null);
    setProfile(null);
    setSession(null);
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
      await fetchProfile(user.id);
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
