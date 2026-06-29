import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useAppStore } from '@/state/useAppStore';
import { onboardingPath, resolveOnboardingStep } from '@/lib/onboardingRoute';
import { colors } from '@/theme';
import { View, ActivityIndicator } from 'react-native';
// import { ClaimSplashScreen } from '@/components/ClaimSplashScreen';

/** Cold-start entry — declarative redirect once auth + storage are ready. */
export default function Index() {
  const { session, authReady, accountReady } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const nameConfirmed = useAppStore((s) => s.nameConfirmed);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);
  const crewMeta = useAppStore((s) => s.crewMeta);

  if (!authReady || !accountReady || !onboardingHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.acid} />
      </View>
    );
  }

  const step = resolveOnboardingStep({
    session: Boolean(session),
    onboarded,
    nameConfirmed,
    hasCrew: Boolean(crewMeta.id),
  });

  if (step) {
    return <Redirect href={onboardingPath(step)} />;
  }

  return <Redirect href="/(tabs)" />;
}
