import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { GoogleAuthLoadingScreen } from '@/components/GoogleAuthLoadingScreen';
import { useMinSplashElapsed } from '@/hooks/useMinSplashElapsed';
import {
  authRedirectUri,
  createSessionFromUrl,
  urlHasAuthParams,
} from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

/**
 * OAuth return route. Google redirects to e.g.
 * exp://192.168.31.237:8081/--/auth/callback?code=...
 * Expo Router may expose ?code= as search params instead of keeping it on the URL string.
 */
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const localParams = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();
  const handled = useRef(false);
  const minSplashDone = useMinSplashElapsed(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || handled.current) return;

    const callbackUrl = url ?? authRedirectUri;
    const params = { ...globalParams, ...localParams };

    if (!urlHasAuthParams(callbackUrl, params)) {
      return;
    }

    handled.current = true;

    (async () => {
      try {
        const session = await createSessionFromUrl(callbackUrl, params);
        setRedirectPath(session ? '/' : '/(onboarding)/welcome');
      } catch (err) {
        console.warn('[auth] callback route error:', err);
        setRedirectPath('/(onboarding)/welcome');
      }
    })();
  }, [url, localParams, globalParams]);

  useEffect(() => {
    if (!redirectPath || !minSplashDone) return;
    router.replace(redirectPath as '/' | '/(onboarding)/welcome');
  }, [redirectPath, minSplashDone, router]);

  return <GoogleAuthLoadingScreen />;
}
