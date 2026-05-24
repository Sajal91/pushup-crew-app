import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { clampDisplayName, displayNameFromSupabaseUser } from './displayName';
import { generateOAuthState } from './oauthCrypto';
import { supabase, supabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** Add this exact URI under Supabase → Authentication → URL Configuration → Redirect URLs */
export const authRedirectUri = makeRedirectUri({
  scheme: 'pushupcrew',
  path: 'auth/callback',
});

if (__DEV__) {
  console.log('[auth] Add this redirect URL in Supabase → Auth → URL Configuration:', authRedirectUri);
}

export type GoogleSignInResult =
  | { ok: true; session: Session; displayName: string }
  | { ok: false; reason: string };

type OAuthParams = Record<string, string>;

function pickParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

/** Parse OAuth query/hash params from a redirect URL (exp://, pushupcrew://, etc.). */
export function parseOAuthParams(
  url: string,
  extra?: Record<string, string | string[] | undefined>,
): OAuthParams {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  const merged: OAuthParams = {};

  if (errorCode) merged.errorCode = errorCode;

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') merged[key] = value;
  }

  if (!merged.code && !merged.access_token) {
    const parsed = Linking.parse(url);
    for (const [key, value] of Object.entries(parsed.queryParams ?? {})) {
      if (typeof value === 'string' && !merged[key]) merged[key] = value;
    }
  }

  if (extra) {
    const code = pickParam(extra.code);
    const accessToken = pickParam(extra.access_token);
    const refreshToken = pickParam(extra.refresh_token);
    const error = pickParam(extra.error);
    if (code) merged.code = code;
    if (accessToken) merged.access_token = accessToken;
    if (refreshToken) merged.refresh_token = refreshToken;
    if (error) merged.error = error;
  }

  return merged;
}

export function urlHasAuthParams(
  url: string,
  extra?: Record<string, string | string[] | undefined>,
): boolean {
  const params = parseOAuthParams(url, extra);
  return Boolean(
    params.errorCode ||
    params.code ||
    params.access_token ||
    params.error ||
    params.error_description,
  );
}

export async function createSessionFromUrl(
  url: string,
  extra?: Record<string, string | string[] | undefined>,
): Promise<Session | null> {
  if (!supabase) return null;

  const params = parseOAuthParams(url, extra);

  // Handle OAuth errors
  if (params.errorCode || params.error) {
    throw new Error(
      params.error_description ??
      params.error ??
      params.errorCode ??
      'oauth-error'
    );
  }

  // PKCE / Authorization Code Flow
  if (params.code) {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(params.code);

    if (error) throw error;

    return data.session;
  }

  // Implicit Flow
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;

    return data.session;
  }

  if (__DEV__) {
    console.warn(
      '[auth] Redirect without tokens. Check Supabase redirect URLs:',
      url
    );
  }

  throw new Error('No auth code or tokens in redirect URL');
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, reason: 'supabase-not-configured' };
  }

  try {
    void generateOAuthState();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUri,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
        scopes: 'openid profile email',
      },
    });

    if (error) {
      console.warn('[auth] OAuth start failed:', error.message);
      return { ok: false, reason: error.message };
    }

    if (!data?.url) {
      return { ok: false, reason: 'no-oauth-url' };
    }

    const browserResult = await WebBrowser.openAuthSessionAsync(
      data.url,
      authRedirectUri,
    );

    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
      return { ok: false, reason: 'cancelled' };
    }

    if (browserResult.type !== 'success') {
      return { ok: false, reason: 'auth-dismissed' };
    }

    if (__DEV__) {
      console.log('[auth] OAuth redirect received:', browserResult.url);
    }

    const session = await createSessionFromUrl(browserResult.url);
    if (!session) {
      return { ok: false, reason: 'no-session' };
    }

    return {
      ok: true,
      session,
      displayName: displayNameFromSupabaseUser(session.user),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.warn('[auth] Google sign-in error:', message);
    return { ok: false, reason: message };
  }
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export function displayNameFromSession(session: Session): string {
  return displayNameFromSupabaseUser(session.user);
}

function stringMetadataValue(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === 'string' ? value : '';
}

export function profileImageFromSession(session: Session): string {
  const meta = session.user.user_metadata ?? {};
  const identityData = session.user.identities?.flatMap((identity) => {
    const data = identity.identity_data;
    return data ? [data] : [];
  }) ?? [];
  const candidates = [meta, ...identityData];
  const keys = ['picture', 'avatar_url', 'image', 'image_url'];
  const value = candidates
    .flatMap((candidate) => keys.map((key) => stringMetadataValue(candidate, key)))
    .find((candidate) => candidate.trim());

  return value?.trim() ?? '';
}

/** Persist display name to Supabase user metadata (Google profile fields). */
export async function updateUserDisplayName(raw: string): Promise<void> {
  if (!supabase) return;
  const name = clampDisplayName(raw);
  const { error } = await supabase.auth.updateUser({
    data: { full_name: name, name },
  });
  if (error) throw error;
}
