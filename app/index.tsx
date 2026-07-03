import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useAppStore } from '@/state/useAppStore';
import { onboardingPath, resolveOnboardingStep } from '@/lib/onboardingRoute';
import { GoogleAuthLoadingScreen } from '@/components/GoogleAuthLoadingScreen';
import { useMinSplashElapsed } from '@/hooks/useMinSplashElapsed';

/** Cold-start entry — declarative redirect once auth + storage are ready. */
export default function Index() {
  const { session, authReady, accountReady } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const nameConfirmed = useAppStore((s) => s.nameConfirmed);
  const onboardingHydrated = useAppStore((s) => s.onboardingHydrated);
  const crewMeta = useAppStore((s) => s.crewMeta);
  const minSplashDone = useMinSplashElapsed(true);

  const dataReady = authReady && accountReady && onboardingHydrated;

  if (!dataReady || !minSplashDone) {
    return <GoogleAuthLoadingScreen />;
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
