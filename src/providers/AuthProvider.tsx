import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import {
  createSessionFromUrl,
  displayNameFromSession,
  signInWithGoogle as googleSignIn,
  signOut as authSignOut,
  urlHasAuthParams,
} from '@/lib/auth';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/state/useAppStore';

type AuthContextValue = {
  session: Session | null;
  authReady: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; reason?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STARTUP_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Auth startup timed out'));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [signingIn, setSigningIn] = useState(false);

  const hydrateOnboarding = useAppStore((s) => s.hydrateOnboarding);
  const applyAuthProfile = useAppStore((s) => s.applyAuthProfile);
  const clearAuthProfile = useAppStore((s) => s.clearAuthProfile);

  const handleAuthRedirect = useCallback(
    async (url: string, extra?: Record<string, string | string[] | undefined>) => {
      if (!supabase || !urlHasAuthParams(url, extra)) return;
      try {
        const next = await createSessionFromUrl(url, extra);
        if (next) {
          setSession(next);
          applyAuthProfile(displayNameFromSession(next), next.user.id);
        }
      } catch (err) {
        console.warn('[auth] Failed to parse redirect URL:', err);
      }
    },
    [applyAuthProfile],
  );

  const incomingUrl = Linking.useURL();

  useEffect(() => {
    hydrateOnboarding();
  }, [hydrateOnboarding]);

  useEffect(() => {
    if (incomingUrl) {
      void handleAuthRedirect(incomingUrl);
    }
  }, [incomingUrl, handleAuthRedirect]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    withTimeout(supabase.auth.getSession(), AUTH_STARTUP_TIMEOUT_MS)
      .then(({ data: { session: initial } }) => {
        if (!mounted) return;
        setSession(initial);
        if (initial) {
          applyAuthProfile(displayNameFromSession(initial), initial.user.id);
        }
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn('[auth] Startup session check failed:', err);
        }
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        applyAuthProfile(displayNameFromSession(next), next.user.id);
      } else {
        clearAuthProfile();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyAuthProfile, clearAuthProfile]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result.ok) {
        setSession(result.session);
        applyAuthProfile(result.displayName, result.session.user.id);
      }
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, reason: result.reason };
    } finally {
      setSigningIn(false);
    }
  }, [applyAuthProfile]);

  const signOut = useCallback(async () => {
    await authSignOut();
    clearAuthProfile();
    setSession(null);
  }, [clearAuthProfile]);

  const value = useMemo(
    () => ({
      session,
      authReady,
      signingIn,
      signInWithGoogle,
      signOut,
    }),
    [session, authReady, signingIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
