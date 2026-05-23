import { supabaseConfigured } from '@/lib/supabase';

export type OnboardingStep = 'welcome' | 'name' | 'crew' | 'goal';

type ResolveArgs = {
  session: boolean;
  onboarded: boolean;
  nameConfirmed: boolean;
  hasCrew: boolean;
};

/** Next onboarding screen the user should be on (null = main app). */
export function resolveOnboardingStep({
  session,
  onboarded,
  nameConfirmed,
  hasCrew,
}: ResolveArgs): OnboardingStep | null {
  // Signed-out users always start at welcome when Supabase auth is enabled.
  if (supabaseConfigured && !session) {
    return 'welcome';
  }

  if (!supabaseConfigured) {
    if (!nameConfirmed) return 'welcome';
    if (!onboarded) return 'crew';
    return null;
  }

  if (!nameConfirmed) return 'name';

  if (!onboarded) {
    return hasCrew ? 'goal' : 'crew';
  }

  if (!hasCrew) return 'crew';

  return null;
}

export function onboardingPath(step: OnboardingStep): `/(onboarding)/${OnboardingStep}` {
  return `/(onboarding)/${step}`;
}
