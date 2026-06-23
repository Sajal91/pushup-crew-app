import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { ClaimPager } from '@/components/ClaimPager';
import { ClaimDots } from '@/components/ClaimDots';
import { CLAIMS, pickRandomClaimIndex } from '@/lib/claims';
import { useAuth } from '@/providers/AuthProvider';
import { supabaseConfigured } from '@/lib/supabase';
import CustomGoogleButton from '@/components/CustomGoogleButton';

export default function Welcome() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [activeClaimIndex, setActiveClaimIndex] = useState(pickRandomClaimIndex);

  const handleGoogleSignIn = async () => {
    setError(null);
    const result = await signInWithGoogle();
    if (result.ok) {
      router.replace(
        result.redirectPath as
          | '/(tabs)'
          | '/(onboarding)/welcome'
          | '/(onboarding)/name'
          | '/(onboarding)/crew'
          | '/(onboarding)/goal',
      );
      return;
    }
    if (result.reason === 'cancelled') return;
    if (result.reason === 'supabase-not-configured') {
      setError('Add Supabase URL and anon key to .env, then restart Expo.');
      return;
    }
    if (result.reason === 'no-oauth-url') {
      setError('Could not start Google sign-in. Check Supabase Google provider settings.');
      return;
    }
    setError(result.reason ?? 'Sign-in failed. Try again.');
  };

  const handleDemoContinue = () => {
    router.replace('/(onboarding)/name');
  };

  return (
    <OnboardingScreen
      scroll={false}
      footer={
        <>
          <ClaimDots total={CLAIMS.length} active={activeClaimIndex} />
          {supabaseConfigured ? (
            <CustomGoogleButton onPress={handleGoogleSignIn} />
          ) : (
            <AcidButton label="CONTINUE IN DEMO MODE →" onPress={handleDemoContinue} />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!supabaseConfigured ? (
            <Text style={styles.hint}>
              Add Supabase + Google env vars for real sign-in. Demo mode skips auth.
            </Text>
          ) : null}
        </>
      }
    >
      <Kicker style={styles.kicker}>// PUSHUPCREW / V1.0</Kicker>
      <View style={styles.claimArea}>
        <ClaimPager
          initialIndex={activeClaimIndex}
          autoScroll
          onActiveIndexChange={setActiveClaimIndex}
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    marginTop: 28,
    marginBottom: 24,
  },
  claimArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start"
  },
  hint: {
    marginTop: 8,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.dim,
    textAlign: 'center',
    lineHeight: 15,
  },
  error: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.blood,
    textAlign: 'center',
    lineHeight: 18,
  },
});
