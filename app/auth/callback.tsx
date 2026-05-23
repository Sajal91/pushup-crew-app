import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors } from '@/theme';
import {
  authRedirectUri,
  createSessionFromUrl,
  displayNameFromSession,
  urlHasAuthParams,
} from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/state/useAppStore';

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
  const applyAuthProfile = useAppStore((s) => s.applyAuthProfile);
  const onboarded = useAppStore((s) => s.onboarded);
  const handled = useRef(false);

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
        if (session) {
          applyAuthProfile(displayNameFromSession(session), session.user.id);
          router.replace(onboarded ? '/(tabs)' : '/(onboarding)/name');
          return;
        }
      } catch (err) {
        console.warn('[auth] callback route error:', err);
      }

      router.replace('/(onboarding)/welcome');
    })();
  }, [url, localParams, globalParams, applyAuthProfile, onboarded, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.acid} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
