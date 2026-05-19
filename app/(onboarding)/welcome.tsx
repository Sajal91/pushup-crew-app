import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';

export default function Welcome() {
  const router = useRouter();

  return (
    <OnboardingScreen
      step={0}
      footer={
        <>
          <AcidButton label="LET'S GO →" onPress={() => router.push('/(onboarding)/name')} />
          {/* TODO(auth): wire Apple/Google sign-in here for returning users */}
          <AcidButton
            label="I already have an account →"
            variant="ghost"
            onPress={() => {
              /* no-op stub */
            }}
          />
        </>
      }
    >
      <Kicker style={{ marginTop: 28, marginBottom: 24 }}>// PUSHUPCREW / V1.0</Kicker>
      <Text style={styles.headline}>EAT.</Text>
      <Text style={styles.headline}>SLEEP.</Text>
      <Text style={[styles.headline, styles.headlineAcid]}>PUSHUP.</Text>
      <Text style={styles.headline}>REPEAT.</Text>
      <Text style={styles.subhead}>
        Track your pushups. See who&apos;s delivering in the crew.{' '}
        <Text style={styles.subheadStrong}>Skip a day → €1 in the pot.</Text>
      </Text>
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
});
