import { Redirect } from 'expo-router';

/** Default onboarding group route → welcome (sign-in). */
export default function OnboardingIndex() {
  return <Redirect href="/(onboarding)/welcome" />;
}
