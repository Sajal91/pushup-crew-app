import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { useAuth } from '@/providers/AuthProvider';
import { supabaseConfigured } from '@/lib/supabase';
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin'

export default function Welcome() {
  const router = useRouter();
  const { signInWithGoogle, signingIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    const result = await signInWithGoogle();
    if (result.ok) {
      router.replace('/(onboarding)/crew');
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

  return (
    <OnboardingScreen
      footer={
        <>
          {supabaseConfigured ? (
            // <AcidButton
            //   label={signingIn ? 'SIGNING IN…' : 'CONTINUE WITH GOOGLE →'}
            //   disabled={signingIn}
            //   onPress={handleGoogleSignIn}
            // />
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={handleGoogleSignIn}
            />
          ) : (
            <AcidButton
              label="CONTINUE IN DEMO MODE →"
              onPress={() => router.replace('/(onboarding)/crew')}
            />
          )}
          {signingIn ? (
            <ActivityIndicator color={colors.acid} style={{ marginTop: 8 }} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!supabaseConfigured ? (
            <Text style={styles.hint}>
              Add Supabase + Google env vars for real sign-in. Demo mode skips auth.
            </Text>
          ) : null}
        </>
      }
    >
      <Kicker style={{ marginTop: 28, marginBottom: 24 }}>// PUSHUPCREW / V1.0</Kicker>
      <Text style={styles.headline}>EAT.</Text>
      <Text style={styles.headline}>SLEEP.</Text>
      <Text style={[styles.headline, styles.headlineAcid]}>PUSHUP.</Text>
      <Text style={styles.headline}>REPEAT.</Text>
      <Text style={styles.subhead}>
        Sign in with Google to track pushups with your crew.{' '}
        <Text style={styles.subheadStrong}>Skip a day → €1 in the pot.</Text>
      </Text>
      <Text style={styles.note}>// YOUR NAME COMES FROM YOUR GOOGLE PROFILE</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fonts.display,
    fontSize: 90,
    lineHeight: 96,
    paddingTop: 8,
    color: colors.text,
    letterSpacing: -1,
  },
  headlineAcid: {
    color: colors.acid,
    ...glows.acidText,
  },
  subhead: {
    marginTop: 28,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.dim,
  },
  subheadStrong: {
    color: colors.text,
    fontFamily: fonts.bodySemi,
  },
  note: {
    marginTop: 20,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
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
