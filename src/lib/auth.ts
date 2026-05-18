// Auth stubs — wires Apple + Google sign-in once Supabase is configured.
//
// Apple Sign In:
//   - Requires an Apple Developer account + Sign in with Apple capability
//   - In Supabase: Authentication → Providers → Apple, set the client ID + secret
//   - On iOS this uses expo-apple-authentication (already in package.json)
//
// Google Sign In:
//   - Create OAuth credentials in Google Cloud Console (iOS + Web client IDs)
//   - In Supabase: Authentication → Providers → Google, set the client ID + secret
//   - On native we use @react-native-google-signin/google-signin
//
// Until configured, both functions log a warning and return null so the rest
// of the app keeps working with mock state.

import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, supabaseConfigured } from './supabase';

// export async function signInWithApple(): Promise<{ ok: boolean; reason?: string }> {
//   if (!supabaseConfigured || !supabase) {
//     console.warn('[auth] Supabase not configured — skipping Apple sign-in.');
//     return { ok: false, reason: 'supabase-not-configured' };
//   }

//   try {
//     const credential = await AppleAuthentication.signInAsync({
//       requestedScopes: [
//         AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
//         AppleAuthentication.AppleAuthenticationScope.EMAIL,
//       ],
//     });

//     if (!credential.identityToken) return { ok: false, reason: 'no-identity-token' };

//     const { error } = await supabase.auth.signInWithIdToken({
//       provider: 'apple',
//       token: credential.identityToken,
//     });

//     if (error) return { ok: false, reason: error.message };
//     return { ok: true };
//   } catch (err: any) {
//     if (err?.code === 'ERR_REQUEST_CANCELED') return { ok: false, reason: 'cancelled' };
//     return { ok: false, reason: err?.message ?? 'unknown' };
//   }
// }

export async function signInWithGoogle(): Promise<{ ok: boolean; reason?: string }> {
  // TODO(google): configure @react-native-google-signin/google-signin with
  //   the iOS + Web client IDs from .env, then exchange the idToken with
  //   supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }).
  console.warn('[auth] Google sign-in not yet wired — see auth.ts TODO.');
  return { ok: false, reason: 'not-implemented' };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
