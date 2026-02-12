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
    // Track which user ID we already started fetching for (dedup)
    let fetchingForId: string | null = null;

    // Safety timeout — 2s max (was 4s)
    const timeout = setTimeout(() => setLoading(false), 2000);

    const handleUser = async (authUser: User) => {
      // Deduplicate: skip if already fetching for this exact user
      if (fetchingForId === authUser.id) return;
      fetchingForId = authUser.id;
      await fetchProfile(authUser.id);
    };

    // 1) Fast initial session (reads from local storage — near instant)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await handleUser(session.user);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // 2) Listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Only create profile on actual sign-in (not initial page load)
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
    // Use upsert — single query instead of SELECT then INSERT
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email,
            nickname,
          });

        if (profileError) throw profileError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
      // scope: 'local' — clears localStorage without network call
      // This ensures logout ALWAYS works, even offline
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('signOut error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
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

      // Re-fetch to confirm the update was saved
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      // Revert optimistic update
      setProfile(prevProfile);
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithKakao,
        signOut,
        updateProfile,
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
