import React, { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useAnton, Anton_400Regular } from '@expo-google-fonts/anton';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  useFonts as useMono,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { colors } from '@/theme';
import { useAppStore } from '@/state/useAppStore';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { supabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const [antonLoaded] = useAnton({ Anton_400Regular });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [monoLoaded] = useMono({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const fontsReady = antonLoaded && interLoaded && monoLoaded;
  const { session, authReady } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);
  const segments = useSegments();
  const router = useRouter();

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  const gateReady = fontsReady && authReady && onboardingHydrated;

  useEffect(() => {
    if (!gateReady) return;

    const inOnboarding = segments[0] === '(onboarding)';
    const onWelcome = segments[1] === 'welcome';

    if (supabaseConfigured && !session) {
      if (!inOnboarding || !onWelcome) {
        router.replace('/(onboarding)/welcome');
      }
      return;
    }

    if (!onboarded) {
      if (onWelcome) {
        if (supabaseConfigured && session) {
          router.replace('/(onboarding)/crew');
        }
        return;
      }
      if (!inOnboarding) {
        router.replace('/(onboarding)/crew');
      }
      return;
    }

    if (inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [gateReady, session, onboarded, segments, router]);

  if (!gateReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayoutRootView}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
