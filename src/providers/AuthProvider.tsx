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
  profileImageFromSession,
  signInWithGoogle as googleSignIn,
  signOut as authSignOut,
  urlHasAuthParams,
} from '@/lib/auth';
import { postSignInPath } from '@/lib/accountStatus';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import {
  fetchMyAccountStatus,
  mapDbChatMessage,
  upsertMyProfile,
  type DbChatMessage,
} from '@/lib/crewDb';
import { useAppStore } from '@/state/useAppStore';

type SignInResult =
  | { ok: true; redirectPath: string }
  | { ok: false; reason: string };

type AuthContextValue = {
  session: Session | null;
  authReady: boolean;
  accountReady: boolean;
  signingIn: boolean;
  signInWithGoogle: () => Promise<SignInResult>;
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
  const [accountReady, setAccountReady] = useState(!supabaseConfigured);
  const [signingIn, setSigningIn] = useState(false);

  const hydrateOnboarding = useAppStore((s) => s.hydrateOnboarding);
  const applyAuthProfile = useAppStore((s) => s.applyAuthProfile);
  const applyAccountStatus = useAppStore((s) => s.applyAccountStatus);
  const clearAuthProfile = useAppStore((s) => s.clearAuthProfile);
  const syncCrewFromDb = useAppStore((s) => s.syncCrewFromDb);
  const applyRemoteChatMessage = useAppStore((s) => s.applyRemoteChatMessage);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);
  const crewId = useAppStore((s) => s.crewMeta.id);

  const profileUpsertUserIdRef = useRef<string | null>(null);
  const profileUpsertInFlightRef = useRef<Promise<void> | null>(null);
  const validateInFlightRef = useRef<Promise<Session | null> | null>(null);
  const loggedStaleSessionRef = useRef(false);
  const authBootstrappedRef = useRef(false);

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

    if (validateInFlightRef.current) {
      return validateInFlightRef.current;
    }

    const task = (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log("user ", user)
      if (error || !user) {
        if (__DEV__ && !loggedStaleSessionRef.current) {
          console.log('[auth] Cleared expired local session — sign in again.');
          loggedStaleSessionRef.current = true;
        }
        await supabase.auth.signOut({ scope: 'local' });
        return null;
      }

      loggedStaleSessionRef.current = false;
      return next;
    })();

    validateInFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (validateInFlightRef.current === task) {
        validateInFlightRef.current = null;
      }
    }
  }, []);

  const syncAccountAfterAuth = useCallback(
    async (displayName: string, userId: string) => {
      if (!supabaseConfigured) {
        await ensureDbProfile(displayName, userId);
        return;
      }

      try {
        const status = await fetchMyAccountStatus();
        applyAccountStatus(status);

        if (status.hasCrew) {
          await syncCrewFromDb();
        } else if (status.isNewUser) {
          await ensureDbProfile(displayName, userId);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[auth] Could not load account status:', err);
        }
        await ensureDbProfile(displayName, userId);
      }
    },
    [applyAccountStatus, ensureDbProfile, syncCrewFromDb],
  );

  const handleAuthSession = useCallback(
    async (event: AuthChangeEvent, next: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setAccountReady(true);
        setSession(null);
        profileUpsertUserIdRef.current = null;
        clearAuthProfile();
        return;
      }

      const shouldValidate =
        event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED';
      const validated =
        next && supabaseConfigured && shouldValidate ? await validateSession(next) : next;

      setAccountReady(!validated);
      setSession(validated);

      if (!validated) {
        profileUpsertUserIdRef.current = null;
        clearAuthProfile();
        setAccountReady(true);
        return;
      }

      const displayName = displayNameFromSession(validated);
      try {
        applyAuthProfile(displayName, validated.user.id, profileImageFromSession(validated));
        await syncAccountAfterAuth(displayName, validated.user.id);
      } finally {
        setAccountReady(true);
      }
    },
    [applyAuthProfile, clearAuthProfile, syncAccountAfterAuth, validateSession],
  );

  const bootstrapAuth = useCallback(
    async (event: AuthChangeEvent, next: Session | null) => {
      if (authBootstrappedRef.current && event === 'INITIAL_SESSION') return;
      if (event === 'INITIAL_SESSION') authBootstrappedRef.current = true;
      await handleAuthSession(event, next);
    },
    [handleAuthSession],
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
    if (!supabaseConfigured || !supabase || !session || !crewId) return;

    const client = supabase;
    const channel = client
      .channel(`crew:${crewId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `crew_id=eq.${crewId}`,
        },
        (payload) => {
          applyRemoteChatMessage(mapDbChatMessage(payload.new as DbChatMessage));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pushup_logs',
          filter: `crew_id=eq.${crewId}`,
        },
        () => {
          void syncCrewFromDb();
        },
      )
      .subscribe((status) => {
        if (__DEV__ && status === 'CHANNEL_ERROR') {
          console.warn('[crew] Realtime channel error');
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [applyRemoteChatMessage, crewId, session, syncCrewFromDb]);

  useEffect(() => {
    if (incomingUrl) {
      void handleAuthRedirect(incomingUrl);
    }
  }, [incomingUrl, handleAuthRedirect]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      setAccountReady(true);
      return;
    }

    let mounted = true;

    const finishBootstrap = () => {
      if (mounted) setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      void bootstrapAuth(event, next).finally(() => {
        if (event === 'INITIAL_SESSION') finishBootstrap();
      });
    });

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!authBootstrappedRef.current) {
        void bootstrapAuth('INITIAL_SESSION', initial).finally(finishBootstrap);
      }
    });

    const fallback = setTimeout(finishBootstrap, AUTH_STARTUP_TIMEOUT_MS);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [bootstrapAuth]);

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    setSigningIn(true);
    try {
      const result = await googleSignIn();
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }

      profileUpsertUserIdRef.current = null;
      await handleAuthSession('SIGNED_IN', result.session);

      const status = await fetchMyAccountStatus();
      const redirectPath = postSignInPath(status, useAppStore.getState().onboarded);

      if (__DEV__) {
        console.log(
          `[auth] ${status.isReturningUser ? 'Returning' : 'New'} user (${status.email ?? 'no email'}) → ${redirectPath}`,
        );
      }

      return { ok: true, redirectPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      return { ok: false, reason: message };
    } finally {
      setSigningIn(false);
    }
  }, [handleAuthSession]);

  const resetOnboarding = useAppStore((s) => s.resetOnboarding);

  const signOut = useCallback(async () => {
    profileUpsertUserIdRef.current = null;
    loggedStaleSessionRef.current = false;
    authBootstrappedRef.current = false;
    setAccountReady(false);
    await authSignOut();
    await resetOnboarding();
    clearAuthProfile();
    setSession(null);
    setAccountReady(true);
  }, [clearAuthProfile, resetOnboarding]);

  const value = useMemo(
    () => ({
      session,
      authReady,
      accountReady,
      signingIn,
      signInWithGoogle,
      signOut,
    }),
    [session, authReady, accountReady, signingIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
