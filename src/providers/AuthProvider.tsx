import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Linking from 'expo-linking';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  createSessionFromUrl,
  displayNameFromSession,
  signInWithGoogle as googleSignIn,
  signOut as authSignOut,
  urlHasAuthParams,
} from '@/lib/auth';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { upsertMyProfile } from '@/lib/crewDb';
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

const PROFILE_UPSERT_EVENTS = new Set<AuthChangeEvent>([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
]);

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
  const syncCrewFromDb = useAppStore((s) => s.syncCrewFromDb);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);

  const profileUpsertUserIdRef = useRef<string | null>(null);
  const profileUpsertInFlightRef = useRef<Promise<void> | null>(null);

  const ensureDbProfile = useCallback(async (name: string, userId: string) => {
    if (!supabaseConfigured) return;

    if (profileUpsertUserIdRef.current === userId && profileUpsertInFlightRef.current) {
      return profileUpsertInFlightRef.current;
    }

    const task = (async () => {
      try {
        await upsertMyProfile(name);
        profileUpsertUserIdRef.current = userId;
      } catch (err) {
        if (__DEV__) {
          console.warn('[auth] Could not upsert profile:', err);
        }
      }
    })();

    profileUpsertInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (profileUpsertInFlightRef.current === task) {
        profileUpsertInFlightRef.current = null;
      }
    }
  }, []);

  const validateSession = useCallback(async (next: Session | null): Promise<Session | null> => {
    if (!next || !supabase) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      if (__DEV__) {
        console.warn('[auth] Clearing invalid cached session:', error?.message);
      }
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    return next;
  }, []);

  const handleAuthSession = useCallback(
    async (event: AuthChangeEvent, next: Session | null) => {
      const shouldValidate =
        event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED';
      const validated =
        next && supabaseConfigured && shouldValidate ? await validateSession(next) : next;

      setSession(validated);

      if (!validated) {
        profileUpsertUserIdRef.current = null;
        clearAuthProfile();
        return;
      }

      const displayName = displayNameFromSession(validated);
      applyAuthProfile(displayName, validated.user.id);

      if (PROFILE_UPSERT_EVENTS.has(event)) {
        void ensureDbProfile(displayName, validated.user.id);
      }
    },
    [applyAuthProfile, clearAuthProfile, ensureDbProfile, validateSession],
  );

  const handleAuthRedirect = useCallback(
    async (url: string, extra?: Record<string, string | string[] | undefined>) => {
      if (!supabase || !urlHasAuthParams(url, extra)) return;
      try {
        const next = await createSessionFromUrl(url, extra);
        if (next) {
          await handleAuthSession('SIGNED_IN', next);
        }
      } catch (err) {
        console.warn('[auth] Failed to parse redirect URL:', err);
      }
    },
    [handleAuthSession],
  );

  const incomingUrl = Linking.useURL();

  useEffect(() => {
    hydrateOnboarding();
  }, [hydrateOnboarding]);

  useEffect(() => {
    if (!supabaseConfigured || !session || !onboardingHydrated) return;
    void syncCrewFromDb();
  }, [session, onboardingHydrated, syncCrewFromDb]);

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
      .then(async ({ data: { session: initial } }) => {
        if (!mounted) return;
        if (initial) {
          await handleAuthSession('INITIAL_SESSION', initial);
        } else {
          setSession(null);
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
    } = supabase.auth.onAuthStateChange((event, next) => {
      void handleAuthSession(event, next);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthSession]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result.ok) {
        profileUpsertUserIdRef.current = null;
        await handleAuthSession('SIGNED_IN', result.session);
      }
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, reason: result.reason };
    } finally {
      setSigningIn(false);
    }
  }, [handleAuthSession]);

  const resetOnboarding = useAppStore((s) => s.resetOnboarding);

  const signOut = useCallback(async () => {
    profileUpsertUserIdRef.current = null;
    await authSignOut();
    await resetOnboarding();
    clearAuthProfile();
    setSession(null);
  }, [clearAuthProfile, resetOnboarding]);

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
