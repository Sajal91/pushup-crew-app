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

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  // Onboarding gate — routes the user into (onboarding) until they finish,
  // then sends them to (tabs).
  const onboarded = useAppStore((s) => s.onboarded);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!fontsReady) return;
    const inOnboarding = segments[0] === '(onboarding)';
    if (!onboarded && !inOnboarding) {
      router.replace('/(onboarding)/welcome');
    } else if (onboarded && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [onboarded, segments, fontsReady, router]);

  if (!fontsReady) return null;

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
