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
import { PushNotificationsSetup } from '@/components/PushNotificationsSetup';
import { onboardingPath, resolveOnboardingStep } from '@/lib/onboardingRoute';
import { supabaseConfigured } from '@/lib/supabase';
import { scheduleTestNotification } from '@/lib/notifications';
import { preloadTapSound } from '@/lib/tapSound';
import { GoogleAuthLoadingScreen } from '@/components/GoogleAuthLoadingScreen';
import { useMinSplashElapsed } from '@/hooks/useMinSplashElapsed';

if (__DEV__) {
  scheduleTestNotification(10)
}

SplashScreen.preventAutoHideAsync().catch(() => { });

function RootNavigator() {
  const [antonLoaded] = useAnton({ Anton_400Regular });

  useEffect(() => {
    preloadTapSound();
  }, []);
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
  const { session, authReady, accountReady, signingOut } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const nameConfirmed = useAppStore((s) => s.nameConfirmed);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);
  const crewMeta = useAppStore((s) => s.crewMeta);
  const segments = useSegments();
  const router = useRouter();

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  const gateReady = fontsReady && authReady && onboardingHydrated && accountReady;
  const minSplashDone = useMinSplashElapsed(fontsReady);
  const appReady = gateReady && minSplashDone;

  useEffect(() => {
    if (!appReady) return;

    const inOnboarding = segments[0] === '(onboarding)';
    const currentStep = segments[1] as string | undefined;
    const inTabs = segments[0] === '(tabs)';
    const inAuth = segments[0] === 'auth';
    const inManageCrew = segments[0] === 'manage-crew';

    // Hard guard: stale or missing auth must never reach crew/tabs.
    if (supabaseConfigured && !session) {
      if (!inOnboarding || currentStep !== 'welcome') {
        router.replace(onboardingPath('welcome'));
      }
      return;
    }

    const nextStep = resolveOnboardingStep({
      session: Boolean(session),
      onboarded,
      nameConfirmed,
      hasCrew: Boolean(crewMeta.id),
    });

    if (nextStep) {
      if (!inOnboarding || currentStep !== nextStep) {
        router.replace(onboardingPath(nextStep));
      }
      return;
    }

    if (!inTabs && !inAuth && !inManageCrew) {
      router.replace('/(tabs)');
    }
  }, [appReady, session, onboarded, nameConfirmed, crewMeta.id, segments, router]);

  if (!fontsReady) return null;

  if (signingOut) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg }}
        onLayout={onLayoutRootView}
      >
        <StatusBar style="light" />
        <GoogleAuthLoadingScreen />
      </View>
    );
  }

  if (!appReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          backgroundColor: colors.bg,
        }}
        onLayout={onLayoutRootView}
      >
        <StatusBar style="light" />
        <GoogleAuthLoadingScreen />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayoutRootView}>
      <StatusBar style="light" />
      <PushNotificationsSetup />
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
